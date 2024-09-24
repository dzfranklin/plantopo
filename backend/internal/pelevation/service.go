package pelevation

import (
	"context"
	"fmt"
	"github.com/cenkalti/backoff/v4"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/tidwall/geojson/geometry"
	"log/slog"
	"sync"
	"time"
)

type Service struct {
	l      *slog.Logger
	input  chan elevationReq
	opener func() (lookuper, error)
}

type lookuper interface {
	lookup(ctx context.Context, points []geometry.Point) ([]int16, error)
}

var singletonMu sync.Mutex
var singleton *Service

type elevationReq struct {
	points []geometry.Point
	ctx    context.Context
	out    chan elevationRes
}

type elevationRes struct {
	value []int16
	err   error
}

func Singleton(env *pconfig.Env) *Service {
	singletonMu.Lock()
	defer singletonMu.Unlock()

	// Defer opening the actual dataset because it involves network requests

	if singleton == nil {
		l := env.Logger.With("app", "pelevation")
		singleton = newService(l, func() (lookuper, error) {
			return openDataset(l, env.Config.Elevation.DEMDataset)
		})
	}

	return singleton
}

func newService(l *slog.Logger, opener func() (lookuper, error)) *Service {
	svc := &Service{
		l:      l,
		input:  make(chan elevationReq),
		opener: opener,
	}
	go svc.runWorker()
	return svc
}

func (s *Service) Lookup(ctx context.Context, points []geometry.Point) ([]int16, error) {
	out := make(chan elevationRes, 1)
	req := elevationReq{
		points: points,
		ctx:    ctx,
		out:    out,
	}

	select {
	case s.input <- req:
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	select {
	case res := <-out:
		return res.value, res.err
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

func (s *Service) runWorker() {
	l := s.l

	var ds lookuper
	initErr := backoff.Retry(func() error {
		l.Info("opening DEM dataset")
		initStart := time.Now()
		var err error
		ds, err = s.opener()
		if err != nil {
			l.Warn("failed to open DEM dataset", "error", err)
			return err
		}
		l.Info("opened DEM dataset", "time", time.Since(initStart))
		return nil
	}, backoff.NewExponentialBackOff(
		backoff.WithInitialInterval(time.Millisecond),
		backoff.WithRetryStopDuration(0)))
	if initErr != nil {
		panic("unreachable: should retry forever")
	}

	for req := range s.input {
		reqCtx, cancel := context.WithTimeout(req.ctx, time.Minute)
		lookupStart := time.Now()
		centroid := computeCentroid(req.points)

		value, lookupErr := ds.lookup(reqCtx, req.points)

		reqLogger := l.With(
			"elapsed", time.Since(lookupStart),
			"points", len(req.points),
			"centroidX", fmt.Sprintf("%.1f", centroid.X),
			"centroidY", fmt.Sprintf("%.1f", centroid.Y))

		if lookupErr != nil {
			reqLogger.Error("failed to lookup elevation points", "error", lookupErr.Error())
		} else {
			reqLogger.Info("looked up elevation points")
		}

		req.out <- elevationRes{value: value, err: lookupErr}
		cancel()
	}
}

func computeCentroid(points []geometry.Point) geometry.Point {
	centroid := geometry.Point{}
	for _, point := range points {
		centroid.X += point.X
		centroid.Y += point.Y
	}
	centroid.X /= float64(len(points))
	centroid.Y /= float64(len(points))
	return centroid
}
