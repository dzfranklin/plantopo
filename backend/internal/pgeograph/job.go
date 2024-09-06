package pgeograph

import (
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
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

func (w *Worker) Work(_ context.Context, _ *river.Job[JobArgs]) error {
	return importLatest(w.env)
}
