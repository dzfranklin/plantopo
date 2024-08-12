package osm

import (
	"bytes"
	"compress/gzip"
	"context"
	"errors"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/phttp"
	"github.com/dzfranklin/plantopo/backend/internal/ptime"
	"github.com/jackc/pgx/v5"
	"github.com/minio/minio-go/v7"
	"github.com/ogen-go/ogen/json"
	"github.com/redis/go-redis/v9"
	"github.com/riverqueue/river"
	"github.com/throttled/throttled/v2"
	throttledredisstore "github.com/throttled/throttled/v2/store/goredisstore.v9"
	"io"
	"log/slog"
	"net/http"
)

const QueueOSMTraceDownloader = "osm_trace_downloader"

const (
	traceBucket   = "openstreetmap-traces"
	maxTraceBytes = 10 * 1024 * 1024 // 10 MiB (before compression)
)

var traceQuota = throttled.RateQuota{MaxRate: throttled.PerMin(1), MaxBurst: 0}

// Feed ingester

type TraceFeedIngesterJobArgs struct{}

func (TraceFeedIngesterJobArgs) Kind() string {
	return "osm_trace_feed_ingester"
}

type TraceFeedIngesterWorker struct {
	l    *slog.Logger
	jobs *river.Client[pgx.Tx]
	river.WorkerDefaults[TraceFeedIngesterJobArgs]
}

func NewTraceFeedIngesterWorker(env *pconfig.Env, jobs *river.Client[pgx.Tx]) *TraceFeedIngesterWorker {
	return &TraceFeedIngesterWorker{l: env.Logger, jobs: jobs}
}

func (w TraceFeedIngesterWorker) Work(ctx context.Context, _ *river.Job[TraceFeedIngesterJobArgs]) error {
	items, err := downloadTraceFeed(ctx)
	if err != nil {
		return err
	}

	for _, item := range items {
		_, err = w.jobs.Insert(ctx, TraceDownloaderJobArgs{Meta: item}, nil)
		if err != nil {
			return err
		}
	}

	return nil
}

func downloadTraceFeed(ctx context.Context) ([]traceMeta, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://www.openstreetmap.org/traces/rss", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "github.com/dzfranklin/plantopo")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("http status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	return parseTraceFeed(body)
}

// Trace downloader

type TraceDownloaderJobArgs struct {
	Meta traceMeta
}

func (TraceDownloaderJobArgs) Kind() string {
	return "osm_trace_downloader"
}

func (TraceDownloaderJobArgs) InsertOpts() river.InsertOpts {
	return river.InsertOpts{
		Queue: QueueOSMTraceDownloader,
		UniqueOpts: river.UniqueOpts{
			ByArgs: true,
		},
	}
}

type TraceDownloaderWorker struct {
	l       *slog.Logger
	limiter *throttled.GCRARateLimiterCtx
	objects *minio.Client
	river.WorkerDefaults[TraceDownloaderJobArgs]
}

func NewTraceDownloaderWorker(env *pconfig.Env) *TraceDownloaderWorker {
	limiter, err := newTraceRateLimiter(env.RDB)
	if err != nil {
		panic("failed to configure rate limiter")
	}

	return &TraceDownloaderWorker{
		l:       env.Logger,
		limiter: limiter,
		objects: env.Objects,
	}
}

func (w *TraceDownloaderWorker) Work(ctx context.Context, job *river.Job[TraceDownloaderJobArgs]) error {
	meta := job.Args.Meta

	metaJSON, err := json.Marshal(meta)
	if err != nil {
		return err
	}

	data, err := downloadTrace(ctx, w.limiter, meta.Download)
	if errors.Is(err, phttp.ErrTooLarge) {
		w.l.Info("skipping large trace", "link", job.Args.Meta.Link)
		return nil
	} else if err != nil {
		return err
	}

	var dataGZ bytes.Buffer
	dataGZW, err := gzip.NewWriterLevel(&dataGZ, gzip.BestCompression)
	if err != nil {
		return err
	}
	_, err = dataGZW.Write(data)
	if err != nil {
		return err
	}
	err = dataGZW.Flush()
	if err != nil {
		return err
	}

	_, err = w.objects.PutObject(ctx, traceBucket, meta.ID+".gpx.gz", &dataGZ, int64(dataGZ.Len()), minio.PutObjectOptions{
		ContentType:     "application/gpx+xml",
		ContentEncoding: "gzip",
	})
	if err != nil {
		return err
	}

	_, err = w.objects.PutObject(ctx, traceBucket, meta.ID+".meta.json", bytes.NewReader(metaJSON), int64(len(metaJSON)), minio.PutObjectOptions{
		ContentType: "application/json",
	})
	if err != nil {
		return err
	}

	return nil
}

func downloadTrace(ctx context.Context, limiter *throttled.GCRARateLimiterCtx, url string) ([]byte, error) {
	for {
		limited, res, err := limiter.RateLimitCtx(ctx, "download", 1)
		if err != nil {
			return nil, err
		}
		if !limited {
			break
		}
		if err := ptime.Sleep(ctx, res.RetryAfter); err != nil {
			return nil, err
		}
	}

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "github.com/dzfranklin/plantopo")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("http status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(phttp.NewMaxBytesReader(resp.Body, maxTraceBytes))
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}

	return body, nil
}

func newTraceRateLimiter(rdb *redis.Client) (*throttled.GCRARateLimiterCtx, error) {
	store, err := throttledredisstore.NewCtx(rdb, "osm_traces_throttle")
	if err != nil {
		return nil, err
	}
	return throttled.NewGCRARateLimiterCtx(store, traceQuota)
}
