package pgeophotos

import (
	"context"
	"errors"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/pflickr"
	"github.com/dzfranklin/plantopo/backend/internal/ptime"
	"golang.org/x/sync/errgroup"
	"log/slog"
	"time"
)

type Service struct {
	l      *slog.Logger
	flickr *pflickr.Indexer
}

func New(env *pconfig.Env) *Service {
	return &Service{flickr: pflickr.NewIndexer(env), l: env.Logger}
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
			if err := s.flickr.IndexOnce(ctx); err != nil {
				if errors.Is(err, context.Canceled) {
					return err
				}
				s.l.Error("failed to index flickr", "error", err)
			}

			if err := ptime.Sleep(ctx, time.Minute*15); err != nil {
				return err
			}
		}
	})

	return group.Wait()
}
