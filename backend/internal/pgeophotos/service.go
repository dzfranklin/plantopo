package pgeophotos

import (
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/pflickr"
	"golang.org/x/sync/errgroup"
)

type Service struct {
	flickr *pflickr.Service
}

func New(env *pconfig.Env) *Service {
	return &Service{flickr: pflickr.NewService(env)}
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
		return s.flickr.IndexFlickr(ctx)
	})

	return group.Wait()
}
