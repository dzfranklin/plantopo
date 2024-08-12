package main

import (
	"github.com/dzfranklin/plantopo/backend/internal/osm"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/dzfranklin/plantopo/backend/internal/pwebhooks"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
	"log"
	"time"
)

func openRiver(db *pgxpool.Pool) (*river.Client[pgx.Tx], *river.Workers) {
	workers := river.NewWorkers()
	client, err := river.NewClient[pgx.Tx](riverpgxv5.New(db), &river.Config{
		Queues: map[string]river.QueueConfig{
			river.QueueDefault:          {MaxWorkers: 100},
			pwebhooks.QueueTwilio:       {MaxWorkers: 100},
			osm.QueueOSMTraceDownloader: {MaxWorkers: 1},
		},
		Workers: workers,
	})
	if err != nil {
		log.Fatal(err)
	}
	return client, workers
}

func setupRiver(env *pconfig.Env, repo *prepo.Repo, jobs *river.Client[pgx.Tx], workers *river.Workers) {
	periodic := jobs.PeriodicJobs()

	river.AddWorker[pwebhooks.TwilioJobArgs](workers, pwebhooks.NewTwilioWorker(env, repo))

	river.AddWorker[osm.TraceFeedIngesterJobArgs](workers, osm.NewTraceFeedIngesterWorker(env, jobs))
	river.AddWorker[osm.TraceDownloaderJobArgs](workers, osm.NewTraceDownloaderWorker(env))

	if env.IsProduction {
		periodic.Add(river.NewPeriodicJob(
			river.PeriodicInterval(time.Hour),
			func() (river.JobArgs, *river.InsertOpts) {
				return osm.TraceFeedIngesterJobArgs{}, nil
			},
			nil,
		))
	}
}
