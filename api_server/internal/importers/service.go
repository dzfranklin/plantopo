package importers

import (
	"context"
	"errors"
	"fmt"
	api "github.com/danielzfranklin/plantopo/api/v1"
	"github.com/danielzfranklin/plantopo/api_server/internal/loggers"
	"github.com/danielzfranklin/plantopo/api_server/internal/sync_backends"
	"github.com/danielzfranklin/plantopo/db"
	"github.com/jackc/pgx/v5"
	"github.com/oklog/ulid/v2"
	"go.uber.org/zap"
	"io"
	"time"
)

type Config struct {
	ObjectStore  ObjectStore
	Matchmaker   api.MatchmakerClient
	SyncBackends *sync_backends.Provider
	Db           *db.Pg
}

type Service struct {
	*Config
}

type ObjectStore interface {
	CreatePresignedUploadURL(ctx context.Context, id string, contentMd5 string) (string, error)
	GetUpload(ctx context.Context, id string) (io.ReadCloser, error)
	PutConversion(ctx context.Context, id string, content []byte) error
}

func New(config *Config) (*Service, error) {
	return &Service{config}, nil
}

type CreateImportRequest struct {
	MapId      string `json:"mapId"`
	Filename   string `json:"filename"`
	Format     string `json:"format"`
	ContentMD5 string `json:"contentMD5"`
}

func (s *Service) CreateImport(ctx context.Context, req *CreateImportRequest) (*Import, error) {
	externalId := ulid.Make().String()
	uploadURL, err := s.ObjectStore.CreatePresignedUploadURL(ctx, externalId, req.ContentMD5)
	if err != nil {
		return nil, fmt.Errorf("create presigned upload url: %w", err)
	}

	_, err = s.Db.Exec(ctx, `INSERT INTO map_imports
    	(external_id, map_id, filename, format) VALUES ($1, $2, $3, $4)
		`, externalId, req.MapId, req.Filename, req.Format)
	if err != nil {
		return nil, fmt.Errorf("insert row: %w", err)
	}

	status, err := s.CheckImport(ctx, externalId)
	if err != nil {
		return nil, err
	}
	status.UploadURL = uploadURL
	return status, nil
}

func (s *Service) StartImport(importId string) (*Import, error) {
	status, err := s.CheckImport(context.Background(), importId)
	if err != nil {
		return nil, err
	}
	if status.Status == "waiting-for-upload" {
		go s.doImport(importId)
	}
	return status, nil
}

func (s *Service) CheckImport(ctx context.Context, externalId string) (*Import, error) {
	status := &Import{
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
	`, externalId).Scan(&status.MapId, &status.Status, &failureMessage)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return status, ErrNotFound
		}
		return status, fmt.Errorf("query row: %w", err)
	}
	if status.Status == "failed" && failureMessage != nil {
		status.StatusMessage = *failureMessage
	}
	return status, nil
}

func (s *Service) doImport(externalId string) {
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
	l = l.With("internalId", internalId, "mapId", mapId)

	upload, err := s.ObjectStore.GetUpload(ctx, externalId)
	if err != nil {
		s.markFailed(externalId, fmt.Errorf("get upload: %w", err), "internal error")
		return
	}
	defer upload.Close()

	changeset, err := convertFormat(format, externalId, filename, upload)
	if err != nil {
		s.markFailed(externalId, fmt.Errorf("convert format: %w", err), "bad upload")
		return
	}
	changesetJson, err := changeset.MarshalJSON()
	if err != nil {
		s.markFailed(externalId, fmt.Errorf("marshal changeset: %w", err), "internal error")
		return
	}

	err = s.ObjectStore.PutConversion(ctx, externalId, changesetJson)
	if err != nil {
		l.Error("failed to put conversion", zap.Error(err))
	}

	resp, err := s.Matchmaker.SetupConnection(ctx, &api.MatchmakerSetupConnectionRequest{
		MapId: mapId,
	})
	if err != nil {
		s.markFailed(externalId, fmt.Errorf("setup connection: %w", err), "internal error")
		return
	}
	l = l.With("backend", resp.Backend)

	bClient, err := s.SyncBackends.Dial(resp.Backend)
	if err != nil {
		s.markFailed(externalId, fmt.Errorf("dial: %w", err), "internal error")
		return
	}
	b, err := bClient.Connect(ctx)
	if err != nil {
		s.markFailed(externalId, fmt.Errorf("connect: %w", err), "internal error")
		return
	}
	l.Info("sending connect to backend")
	err = b.Send(&api.SyncBackendIncomingMessage{
		Msg: &api.SyncBackendIncomingMessage_Connect{
			Connect: &api.SyncBackendConnectRequest{
				MapId:    mapId,
				Token:    resp.Token,
				ClientId: fmt.Sprintf("internal-importer-%d", internalId),
			},
		},
	})
	if err != nil {
		s.markFailed(externalId, fmt.Errorf("send connect: %w", err), "internal error")
		return
	}

	l.Info("sending changeset")
	err = b.Send(&api.SyncBackendIncomingMessage{
		Msg: &api.SyncBackendIncomingMessage_Update{
			Update: &api.SyncBackendIncomingUpdate{
				Seq:    1,
				Change: changesetJson,
			},
		},
	})
	if err != nil {
		s.markFailed(externalId, fmt.Errorf("send changeset: %w", err), "internal error")
		return
	}

	l.Info("waiting for ack")
	for {
		msg, err := b.Recv()
		if err != nil {
			s.markFailed(externalId, fmt.Errorf("recv from backend: %w", err), "internal error")
			return
		}

		if msg.Ack == 1 {
			l.Info("got ack")
			break
		}
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

func (s *Service) markFailed(externalId string, err error, message string) {
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
