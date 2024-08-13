package dftbusopendata

import (
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/minio/minio-go/v7"
	"github.com/riverqueue/river"
	"io"
	"log/slog"
	"os"
)

const (
	bucket = "dft-bus-open-data"
)

type JobArgs struct{}

func (JobArgs) Kind() string {
	return "dft_bus_open_data"
}

func (JobArgs) InsertOpts() river.InsertOpts {
	return river.InsertOpts{
		MaxAttempts: 1,
	}
}

type Worker struct {
	l       *slog.Logger
	objects *minio.Client
	cfg     *pconfig.DFTBusOpenData
	river.WorkerDefaults[JobArgs]
}

func NewWorker(env *pconfig.Env) *Worker {
	return &Worker{l: env.Logger, objects: env.Objects, cfg: &env.Config.DFTBusOpenData}
}

func (w *Worker) Work(ctx context.Context, _ *river.Job[JobArgs]) error {
	w.l.Info("DFT Bus Open Data job starting")

	download, err := DownloadScotland(ctx, w.cfg.Username, w.cfg.Password)
	if err != nil {
		return err
	}

	f, err := os.CreateTemp("", "")
	if err != nil {
		return err
	}
	defer func() {
		err = os.Remove(f.Name())
		if err != nil {
			w.l.Error("failed to remove temp file", "error", err)
		}
	}()

	_, err = io.Copy(f, download)
	if err != nil {
		return err
	}

	err = f.Close()
	if err != nil {
		return err
	}
	err = download.Close()
	if err != nil {
		return err
	}

	_, err = w.objects.FPutObject(ctx, bucket, "scotland.gtfs.zip", f.Name(), minio.PutObjectOptions{})
	if err != nil {
		return err
	}

	w.l.Info("DFT Bus Open Data job complete")
	return nil
}
