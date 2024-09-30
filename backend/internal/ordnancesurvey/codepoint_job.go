package ordnancesurvey

import (
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/riverqueue/river"
	"log/slog"
	"sync"
)

func NewCodepointWorker(env *pconfig.Env) *CodepointWorker {
	return &CodepointWorker{repo: prepo.NewGBPostcode(env), l: env.Logger}
}

type CodepointJobArgs struct{}

func (CodepointJobArgs) Kind() string {
	return "ordnancesurvey_codepoint"
}

type CodepointWorker struct {
	repo *prepo.GBPostcode
	l    *slog.Logger
	river.WorkerDefaults[CodepointJobArgs]
}

func (w *CodepointWorker) Work(ctx context.Context, _ *river.Job[CodepointJobArgs]) error {
	w.l.Info("Starting postcode import")
	var mu sync.Mutex
	points := make([]prepo.GBPostcodePoint, 0, 2_000_000)
	parseErr := ParseLatestCodePointOpen(ctx, func(point PostcodePoint) error {
		mu.Lock()
		defer mu.Unlock()
		points = append(points, prepo.GBPostcodePoint{Code: point.Code, Point: point.Point})
		return nil
	})
	if parseErr != nil {
		return parseErr
	}
	storeErr := w.repo.Set(ctx, points)
	if storeErr != nil {
		return storeErr
	}
	w.l.Info("Imported postcode points")
	return nil
}
