package pgeograph

import (
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/pgeophotos"
	"github.com/riverqueue/river"
	"time"
)

type JobArgs struct{}

func (a JobArgs) Kind() string {
	return "geograph_import"
}

type Worker struct {
	env *pconfig.Env
	river.WorkerDefaults[JobArgs]
}

func NewWorker(env *pconfig.Env) *Worker {
	return &Worker{env: env}
}

func (w *Worker) Timeout(_ *river.Job[JobArgs]) time.Duration {
	return time.Hour * 4
}

func (w *Worker) Work(ctx context.Context, _ *river.Job[JobArgs]) error {
	if err := importLatest(ctx, w.env); err != nil {
		return err
	}

	if _, err := w.env.Jobs.Insert(ctx, pgeophotos.DeployJobArgs{}, nil); err != nil {
		return err
	}

	return nil
}
