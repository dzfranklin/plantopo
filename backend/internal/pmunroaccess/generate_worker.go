package pmunroaccess

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/phttp"
	"github.com/minio/minio-go/v7"
	"github.com/redis/go-redis/v9"
	"github.com/riverqueue/river"
	"io"
	"log/slog"
	"time"
)

const QueueMunroAccessGenerator = "munro_access"

const (
	reportBucket = "munro-access-reports"
	reportExpiry = time.Hour * 24 * 7 * 4
)

type GenerateArgs struct {
	ID   string
	From [2]float64 `json:"from"`
	Date time.Time  `json:"date"`
}

func (j GenerateArgs) Kind() string {
	return "generate_munro_access"
}

func (j GenerateArgs) InsertOpts() river.InsertOpts {
	return river.InsertOpts{
		Queue: QueueMunroAccessGenerator,
	}
}

type GenerateWorker struct {
	l       *slog.Logger
	objects *minio.Client
	rdb     *redis.Client
	river.WorkerDefaults[GenerateArgs]
}

func NewGenerateWorker(env *pconfig.Env) *GenerateWorker {
	return &GenerateWorker{
		l:       env.Logger,
		objects: env.Objects,
		rdb:     env.RDB,
	}
}

func (w GenerateWorker) Timeout(_ *river.Job[GenerateArgs]) time.Duration {
	return time.Hour
}

func (w GenerateWorker) Work(ctx context.Context, job *river.Job[GenerateArgs]) error {
	l := w.l.With("jobID", job.ID, "reportID", job.Args.ID)
	l.Info("beginning work on munro access job")

	if err := pushStatus(ctx, w.rdb, job.Args.ID, "working"); err != nil {
		return err
	}

	err := doGenerateWork(ctx, l, w.objects, job.Args)
	if err != nil {
		l.Error("failed to generate report", "error", err)
		if err := pushStatus(ctx, w.rdb, job.Args.ID, "received"); err != nil {
			return err
		}
		return err
	}

	l.Info("generated report")
	if err := pushStatus(ctx, w.rdb, job.Args.ID, "ready"); err != nil {
		return err
	}

	return nil
}

func pushStatus(ctx context.Context, rdb *redis.Client, id string, status string) error {
	stream := reportEventsKey(id)

	err := rdb.XAdd(ctx, &redis.XAddArgs{
		Stream: stream,
		Values: map[string]any{
			"status":    status,
			"timestamp": time.Now().Format(time.RFC3339),
		},
	}).Err()
	if err != nil {
		return err
	}

	return rdb.Expire(ctx, stream, reportExpiry).Err()
}

func parseStatus(v map[string]any) (Status, error) {
	status, ok := v["status"].(string)
	if !ok {
		return Status{}, errors.New("missing status")
	}

	timestampS, ok := v["timestamp"].(string)
	if !ok {
		return Status{}, errors.New("missing timestamp")
	}
	timestamp, err := time.Parse(time.RFC3339, timestampS)
	if err != nil {
		return Status{}, errors.New("malformed timestamp")
	}

	return Status{Status: status, Timestamp: timestamp}, nil
}

func doGenerateWork(ctx context.Context, l *slog.Logger, objects *minio.Client, args GenerateArgs) error {
	objectName := reportIDToObjectName(args.ID)

	if _, err := objects.StatObject(ctx, reportBucket, objectName, minio.StatObjectOptions{}); err == nil {
		l.Info("report already exists, bailing before any work")
		return nil
	}

	reqBody, err := json.Marshal(map[string]any{
		"date": args.Date,
		"from": args.From,
	})
	if err != nil {
		return err
	}
	resp, err := phttp.Post(ctx, "http://geder:2001/v1/submit-munro-access-job",
		"application/json", bytes.NewReader(reqBody))
	if err != nil {
		return err
	}
	l.Info("report generation complete")

	var report bytes.Buffer

	reportCompressor, err := gzip.NewWriterLevel(&report, gzip.BestCompression)
	if err != nil {
		return err
	}
	if _, err := io.Copy(reportCompressor, resp.Body); err != nil {
		return err
	}
	if err := reportCompressor.Close(); err != nil {
		return err
	}

	if _, err := objects.StatObject(ctx, reportBucket, objectName, minio.StatObjectOptions{}); err == nil {
		l.Info("report already exists, bailing after work")
		return nil
	}

	_, err = objects.PutObject(ctx, reportBucket, objectName, &report, int64(report.Len()), minio.PutObjectOptions{
		ContentType:     "application/json",
		ContentEncoding: "gzip",
		Expires:         time.Now().Add(reportExpiry),
	})
	if err != nil {
		return err
	}
	l.Info("uploaded compressed report")

	return nil
}
