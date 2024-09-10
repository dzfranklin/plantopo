package pgeophotos

import (
	"context"
	"errors"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/pflickr"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/dzfranklin/plantopo/backend/internal/ptime"
	"github.com/jackc/pgx/v5"
	"github.com/minio/minio-go/v7"
	"github.com/riverqueue/river"
	"golang.org/x/sync/errgroup"
	"log/slog"
	"os"
	"path"
	"time"
)

type Service struct {
	l       *slog.Logger
	flickr  *pflickr.Indexer
	repo    *prepo.Geophotos
	objects *minio.Client
	jobs    *river.Client[pgx.Tx]
}

func New(env *pconfig.Env) *Service {
	return &Service{
		flickr:  pflickr.NewIndexer(env),
		l:       env.Logger,
		repo:    prepo.New(env).Geophotos,
		objects: env.Objects,
		jobs:    env.Jobs,
	}
}

func (s *Service) RunIndexer(ctx context.Context) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	group, groupCtx := errgroup.WithContext(ctx)

	go func() {
		<-groupCtx.Done()
		cancel()
	}()

	group.Go(func() error {
		for {
			didIndex, indexErr := s.flickr.IndexOnce(ctx)
			if errors.Is(indexErr, context.Canceled) {
				return os.ErrExist
			} else if indexErr != nil {
				s.l.Error("failed to index flickr", "error", indexErr)
			}

			if didIndex {
				if _, err := s.jobs.Insert(ctx, DeployJobArgs{}, nil); err != nil {
					s.l.Error("insert error", "error", err)
				}
			}

			if err := ptime.Sleep(ctx, time.Minute*15); err != nil {
				return err
			}
		}
	})

	return group.Wait()
}

func (s *Service) deployTiles(ctx context.Context) error {
	workdir, workdirErr := os.MkdirTemp("", "")
	if workdirErr != nil {
		return workdirErr
	}
	defer func() {
		if err := os.RemoveAll(workdir); err != nil {
			s.l.Error("failed to clean up workdir", "error", err)
		}
	}()

	// Build features file

	featuresPath := path.Join(workdir, "features.fgb")
	featuresF, createFeaturesFErr := os.Create(featuresPath)
	if createFeaturesFErr != nil {
		return createFeaturesFErr
	}
	defer featuresF.Close()

	s.l.Info("building flatgeobuf of geophotos")
	if err := s.buildFlatGeobuf(ctx, featuresF); err != nil {
		return err
	}

	if err := featuresF.Close(); err != nil {
		return err
	}

	// Tile

	s.l.Info("converting features to pmtiles")
	tilesOut := path.Join(workdir, "geophotos.pmtiles")
	if err := s.tilePoints(ctx, featuresPath, tilesOut); err != nil {
		return err
	}

	// Upload

	_, uploadErr := s.objects.FPutObject(ctx, "pmtiles-public", "geophotos.pmtiles", tilesOut, minio.PutObjectOptions{})
	if uploadErr != nil {
		return uploadErr
	}

	s.l.Info("done deploying tiles")
	return nil
}
