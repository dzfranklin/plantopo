package demouser

import (
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/riverqueue/river"
)

type ResetJobArgs struct{}

func (ResetJobArgs) Kind() string { return "demouser_reset" }

type ResetWorker struct {
	env *pconfig.Env
	river.WorkerDefaults[ResetJobArgs]
}

func NewResetWorker(env *pconfig.Env) *ResetWorker {
	return &ResetWorker{env: env}
}

func (w *ResetWorker) Work(ctx context.Context, _ *river.Job[ResetJobArgs]) error {
	return Reset(ctx, w.env)
}
