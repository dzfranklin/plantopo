package mapsync

import (
	"context"
	"errors"
	"fmt"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/danielzfranklin/plantopo/api_server/internal/loggers"
	"github.com/danielzfranklin/plantopo/db"
	"github.com/jackc/pgx/v5"
	"github.com/oklog/ulid/v2"
	"go.uber.org/zap"
	"google.golang.org/grpc/status"
	"time"
)

var ImportNotFound = errors.New("import not found")

type Import struct {
	Id    string `json:"id"`
	MapId string `json:"mapId"`
	// Status is one of "not-started", "in-progress", "complete", "failed"
	Status        string `json:"status"`
	StatusMessage string `json:"statusMessage,omitempty"`
	UploadURL     string `json:"uploadURL,omitempty"`
}

type ImporterConfig struct {
	S3       S3
	Bucket   string
	Importer MapImporter
	Db       *db.Pg
}

type MapImporter interface {
	Import(ctx context.Context, mapId string, info ImportInfo) error
}

type Importer struct {
	*ImporterConfig
}

func NewImporter(config *ImporterConfig) *Importer {
	return &Importer{config}
}

type CreateImportRequest struct {
	MapId      string `json:"mapId"`
	Filename   string `json:"filename"`
	Format     string `json:"format"`
	ContentMD5 string `json:"contentMD5"`
}

func (s *Importer) CreateImport(ctx context.Context, req *CreateImportRequest) (*Import, error) {
	externalId := ulid.Make().String()

	presign, err := s.S3.PresignPutObject(
		ctx,
		&s3.PutObjectInput{
			Bucket:     &s.Bucket,
			Key:        &externalId,
			ContentMD5: &req.ContentMD5,
		},
		func(options *s3.PresignOptions) {
			options.Expires = 1 * time.Hour
		},
	)
	if err != nil {
		return nil, fmt.Errorf("create presigned upload url: %w", err)
	}
	uploadURL := presign.URL

	_, err = s.Db.Exec(ctx, `INSERT INTO map_imports
    	(external_id, map_id, filename, format) VALUES ($1, $2, $3, $4)
		`, externalId, req.MapId, req.Filename, req.Format)
	if err != nil {
		return nil, fmt.Errorf("insert row: %w", err)
	}

	st, err := s.CheckImport(ctx, externalId)
	if err != nil {
		return nil, err
	}
	st.UploadURL = uploadURL
	return st, nil
}

func (s *Importer) StartImport(importId string) (*Import, error) {
	st, err := s.CheckImport(context.Background(), importId)
	if err != nil {
		return nil, err
	}
	if st.Status == "waiting-for-upload" {
		go s.doImport(importId)
	}
	return st, nil
}

func (s *Importer) CheckImport(ctx context.Context, externalId string) (*Import, error) {
	st := &Import{
		Id: externalId,
	}
	var failureMessage *string
	err := s.Db.QueryRow(ctx, `
		SELECT
		    map_id,
			CASE
				WHEN failed_at IS NOT NULL THEN 'failed'
				WHEN completed_at IS NOT NULL THEN 'complete'
				WHEN started_at IS NOT NULL THEN 'in-progress'
				ELSE 'waiting-for-upload'
			END AS status,
		    failure_message
		FROM map_imports
		WHERE external_id = $1
	`, externalId).Scan(&st.MapId, &st.Status, &failureMessage)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return st, ImportNotFound
		}
		return st, fmt.Errorf("query row: %w", err)
	}
	if st.Status == "failed" && failureMessage != nil {
		st.StatusMessage = *failureMessage
	}
	return st, nil
}

func (s *Importer) doImport(externalId string) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()

	l := loggers.Get().Sugar().Named("importer").With(zap.String("externalId", externalId))

	var internalId int64
	var mapId string
	var filename string
	var format string
	err := s.Db.QueryRow(ctx, `
		UPDATE map_imports
		SET started_at = NOW()
		WHERE external_id = $1 AND started_at IS NULL
		RETURNING internal_id, map_id, filename, format`,
		externalId).Scan(&internalId, &mapId, &filename, &format)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			l.Info("import already started")
			return
		}
		s.markFailed(externalId, fmt.Errorf("mark row started: %w", err), "internal error")
		return
	}

	presign, err := s.S3.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: &s.Bucket,
		Key:    &externalId,
	}, func(options *s3.PresignOptions) {
		options.Expires = 60 * time.Minute
	})
	if err != nil {
		s.markFailed(externalId, fmt.Errorf("create presigned download url: %w", err), "internal error")
		return
	}

	err = s.Importer.Import(ctx, mapId, ImportInfo{
		Format:               format,
		URL:                  presign.URL,
		ImportId:             externalId,
		ImportedFromFilename: filename,
	})
	if err != nil {
		if st, ok := status.FromError(err); ok {
			if st.Code() == 400 {
				s.markFailed(externalId, fmt.Errorf("import: %w", err), st.Message())
				return
			}
		}
		s.markFailed(externalId, fmt.Errorf("import: %w", err), "internal error")
		return
	}

	_, err = s.Db.Exec(ctx, `
				UPDATE map_imports
				SET completed_at = NOW()
				WHERE external_id = $1
			`, externalId)
	if err != nil {
		s.markFailed(externalId, fmt.Errorf("mark row completed: %w", err), "internal error")
		return
	}
}

func (s *Importer) markFailed(externalId string, err error, message string) {
	l := loggers.Get().Sugar().With(zap.String("externalId", externalId))
	l.Errorw("import failed", zap.Error(err))
	_, err = s.Db.Exec(context.Background(), `
		UPDATE map_imports
		SET failed_at = NOW(), failure_message = $2
		WHERE external_id = $1
	`, externalId, message)
	if err != nil {
		l.DPanicw("failed to update row", zap.Error(err))
	}
}
