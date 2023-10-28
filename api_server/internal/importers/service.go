package importers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	api "github.com/danielzfranklin/plantopo/api/v1"
	"github.com/danielzfranklin/plantopo/api_server/internal/logger"
	"github.com/danielzfranklin/plantopo/api_server/internal/sync_backends"
	"github.com/danielzfranklin/plantopo/db"
	"github.com/google/uuid"
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
	CreatePresignedUploadURL(ctx context.Context, id string) (string, error)
	GetUpload(ctx context.Context, id string) (io.ReadCloser, error)
}

func New(config *Config) (*Service, error) {
	return &Service{config}, nil
}

func (s *Service) CreateImport(ctx context.Context, mapId string, format string) (*Import, error) {
	externalId := ulid.Make().String()
	uploadURL, err := s.ObjectStore.CreatePresignedUploadURL(ctx, externalId)
	if err != nil {
		return nil, fmt.Errorf("create presigned upload url: %w", err)
	}

	_, err = s.Db.Exec(ctx, `INSERT INTO map_imports
    	(external_id, map_id, format) VALUES ($1, $2, $3)
		`, externalId, mapId, format)
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
	var failureMessage string
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
	if status.Status == "failed" {
		status.StatusMessage = failureMessage
	}
	return status, nil
}

func (s *Service) doImport(externalId string) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()

	l := logger.Get().Sugar().Named("importer").With(zap.String("externalId", externalId))

	var internalId int64
	var mapId uuid.UUID
	var format string
	err := s.Db.QueryRow(ctx, `
		UPDATE map_imports
		SET started_at = NOW()
		WHERE external_id = $1 AND started_at IS NULL
		RETURNING internal_id, map_id, format`).Scan(&internalId, &mapId, &format)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			l.Info("import already started")
			return
		}
		s.markFailed(externalId, fmt.Errorf("update row: %w", err), "internal error")
		return
	}
	l = l.With("internalId", internalId, "mapId", mapId.String())

	upload, err := s.ObjectStore.GetUpload(ctx, externalId)
	if err != nil {
		s.markFailed(externalId, fmt.Errorf("get upload: %w", err), "internal error")
		return
	}
	defer upload.Close()

	changeset, err := convertFormat(format, externalId, upload)
	if err != nil {
		s.markFailed(externalId, fmt.Errorf("convert format: %w", err), "bad upload")
		return
	}
	changesetJson, err := changeset.MarshalJSON()
	if err != nil {
		s.markFailed(externalId, fmt.Errorf("marshal changeset: %w", err), "internal error")
		return
	}

	resp, err := s.Matchmaker.SetupConnection(ctx, &api.MatchmakerSetupConnectionRequest{
		MapId: mapId.String(),
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
				MapId:        mapId.String(),
				Token:        resp.Token,
				ConnectionId: fmt.Sprintf("internal-importer-%d", internalId),
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

		type dataType struct {
			Ack *int `json:"ack"`
		}
		var data dataType
		err = json.Unmarshal(msg.Data, &data)
		if err != nil {
			s.markFailed(externalId, fmt.Errorf("unmarshal data: %w", err), "internal error")
			return
		}

		if data.Ack != nil && *data.Ack == 1 {
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
		s.markFailed(externalId, fmt.Errorf("update row: %w", err), "internal error")
		return
	}
}

func (s *Service) markFailed(externalId string, err error, message string) {
	l := logger.Get().Sugar().With(zap.String("externalId", externalId))
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
