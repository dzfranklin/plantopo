package pmunroaccess

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/gosimple/slug"
	"github.com/jackc/pgx/v5"
	"github.com/minio/minio-go/v7"
	"github.com/redis/go-redis/v9"
	"github.com/riverqueue/river"
	"log/slog"
	"time"
)

var ErrReportNotFound = errors.New("report not found")

type Service struct {
	l       *slog.Logger
	objects *minio.Client
	rdb     *redis.Client
	jobs    *river.Client[pgx.Tx]
}

func New(env *pconfig.Env) *Service {
	return &Service{l: env.Logger, objects: env.Objects, rdb: env.RDB, jobs: env.Jobs}
}

func (s *Service) GetTemporaryURL(ctx context.Context, id string) (string, error) {
	url, err := s.objects.PresignedGetObject(ctx, reportBucket, reportIDToObjectName(id), time.Hour*24, nil)
	if err != nil {
		return "", err
	}
	return url.String(), nil
}

type Request struct {
	FromLabel string
	FromPoint [2]float64
	Date      time.Time
}

type Meta struct {
	ID          string     `json:"id"`
	Slug        string     `json:"slug"`
	FromLabel   string     `json:"fromLabel"`
	FromPoint   [2]float64 `json:"fromPoint"`
	Date        time.Time  `json:"date"`
	RequestTime time.Time  `json:"requestTime"`
	URL         string     `json:"url,omitempty"` // Only present if status == ready. Not stored
}

func (m Meta) MarshalBinary() ([]byte, error)  { return json.Marshal(m) }
func (m *Meta) UnmarshalBinary(v []byte) error { return json.Unmarshal(v, m) }

func (s *Service) Request(req Request) (Status, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	id := prepo.SecureRandomID("mar", 16)
	reportSlug := slug.MakeLang(req.FromLabel, "en") + "-" + req.Date.Format("2006-01-02")

	_, err := s.jobs.Insert(ctx, GenerateArgs{
		ID:   id,
		From: req.FromPoint,
		Date: req.Date,
	}, nil)
	if err != nil {
		return Status{}, err
	}

	meta := Meta{
		ID:          id,
		Slug:        reportSlug,
		FromLabel:   req.FromLabel,
		FromPoint:   req.FromPoint,
		Date:        req.Date,
		RequestTime: time.Now(),
	}
	if err := s.rdb.Set(ctx, reportKey(id), meta, reportExpiry).Err(); err != nil {
		return Status{}, err
	}

	if err := pushStatus(ctx, s.rdb, id, "received"); err != nil {
		return Status{}, err
	}

	return s.Status(ctx, id)
}

type Status struct {
	ID        string    `json:"id"`     // The ID of the status (not the report)
	Status    string    `json:"status"` // received | working | ready
	Timestamp time.Time `json:"timestamp"`
	Report    Meta      `json:"report"`
}

func (s *Service) Status(ctx context.Context, report string) (Status, error) {
	messages, err := s.rdb.XRevRangeN(ctx, reportEventsKey(report), "+", "-", 1).Result()
	if err != nil {
		return Status{}, err
	}

	if len(messages) == 0 {
		return Status{}, ErrReportNotFound
	}

	status, err := parseStatus(messages[0].Values)
	if err != nil {
		return Status{}, err
	}

	return s.hydrateStatus(ctx, report, messages[0].ID, status)
}

func (s *Service) hydrateStatus(ctx context.Context, report string, statusID string, status Status) (Status, error) {
	status.ID = statusID

	if err := s.rdb.Get(ctx, reportKey(report)).Scan(&status.Report); err != nil {
		return Status{}, err
	}

	if status.Status == "ready" {
		var err error
		status.Report.URL, err = s.GetTemporaryURL(ctx, report)
		if err != nil {
			return Status{}, err
		}
	}

	return status, nil
}

func (s *Service) WatchStatus(ctx context.Context, report string) (<-chan Status, error) {
	stream := reportEventsKey(report)
	lastID := "0"
	out := make(chan Status, 1)

	status, err := s.Status(ctx, report)
	if err != nil {
		return nil, err
	}
	out <- status
	lastID = status.ID

	go func() {
		defer func() { close(out) }()

		for {
			results, err := s.rdb.XRead(ctx, &redis.XReadArgs{
				Streams: []string{stream, lastID},
				Block:   time.Minute,
			}).Result()
			if errors.Is(err, redis.Nil) {
				continue
			} else if err != nil {
				return
			}
			res := results[0]

			for _, msg := range res.Messages {
				lastID = msg.ID

				status, err := parseStatus(msg.Values)
				if err != nil {
					s.l.Error("parse status", "error", err)
					return
				}

				status, err = s.hydrateStatus(ctx, report, msg.ID, status)
				if err != nil {
					s.l.Error("hydrate status", "error", err)
					return
				}

				out <- status
			}
		}
	}()

	return out, nil
}

func (s *Service) WaitForReady(ctx context.Context, report string) (Meta, error) {
	c, err := s.WatchStatus(ctx, report)
	if err != nil {
		return Meta{}, err
	}
	for {
		select {
		case status := <-c:
			if status.Status == "ready" {
				return status.Report, nil
			}
		case <-ctx.Done():
			return Meta{}, ctx.Err()
		}
	}
}

const pregeneratedKey = "pregenerated_munro_access_reports"

type pregeneratedReportsContainer struct {
	Reports []Meta
}

func (c pregeneratedReportsContainer) MarshalBinary() ([]byte, error)  { return json.Marshal(c) }
func (c *pregeneratedReportsContainer) UnmarshalBinary(v []byte) error { return json.Unmarshal(v, c) }

func (s *Service) PregeneratedReports(ctx context.Context) ([]Meta, error) {
	var v pregeneratedReportsContainer
	err := s.rdb.Get(ctx, pregeneratedKey).Scan(&v)
	return v.Reports, err
}

func (s *Service) setPregeneratedReports(ctx context.Context, value []Meta) error {
	return s.rdb.Set(ctx, pregeneratedKey, pregeneratedReportsContainer{value}, 0).Err()
}

func reportIDToObjectName(id string) string {
	return id + ".json"
}

func reportKey(id string) string {
	return "munro_access_report:" + id
}

func reportEventsKey(id string) string {
	return reportKey(id) + ":events"
}
