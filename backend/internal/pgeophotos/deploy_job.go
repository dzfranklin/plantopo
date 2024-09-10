package pgeophotos

import (
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/riverqueue/river"
	"time"
)

type DeployJobArgs struct{}

func (a DeployJobArgs) Kind() string {
	return "geophotos_deploy"
}

func (a DeployJobArgs) InsertOpts() river.InsertOpts {
	return river.InsertOpts{
		UniqueOpts: river.UniqueOpts{
			ByArgs: true,
		},
	}
}

type DeployWorker struct {
	svc *Service
	river.WorkerDefaults[DeployJobArgs]
}

func NewDeployWorker(env *pconfig.Env) *DeployWorker {
	return &DeployWorker{svc: New(env)}
}

func (w *DeployWorker) Timeout(_ *river.Job[DeployJobArgs]) time.Duration {
	return time.Hour * 4
}

func (w *DeployWorker) Work(ctx context.Context, _ *river.Job[DeployJobArgs]) error {
	return w.svc.deployTiles(ctx)
}
