package pjobs

import (
	"github.com/dzfranklin/plantopo/backend/internal/dftbusopendata"
	"github.com/dzfranklin/plantopo/backend/internal/osm"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/pemail"
	"github.com/dzfranklin/plantopo/backend/internal/plog"
	"github.com/dzfranklin/plantopo/backend/internal/pmunroaccess"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/dzfranklin/plantopo/backend/internal/pwebhooks"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
	"github.com/robfig/cron/v3"
	"log"
	"log/slog"
	"time"
)

func Open(db *pgxpool.Pool, logger *slog.Logger) (*river.Client[pgx.Tx], *river.Workers) {
	workers := river.NewWorkers()
	client, err := river.NewClient[pgx.Tx](riverpgxv5.New(db), &river.Config{
		Queues: map[string]river.QueueConfig{
			river.QueueDefault:                     {MaxWorkers: 100},
			pwebhooks.QueueTwilio:                  {MaxWorkers: 100},
			osm.QueueOSMTraceDownloader:            {MaxWorkers: 1},
			pmunroaccess.QueueMunroAccessGenerator: {MaxWorkers: 1},
		},
		Workers: workers,
		Logger:  plog.Filtered(logger.With("app", "river"), slog.LevelWarn),
	})
	if err != nil {
		log.Fatal(err)
	}
	return client, workers
}

func Register(
	env *pconfig.Env,
	jobs *river.Client[pgx.Tx],
	workers *river.Workers,
) {
	repo := prepo.New(env)
	periodic := jobs.PeriodicJobs()

	river.AddWorker[pwebhooks.TwilioJobArgs](workers, pwebhooks.NewTwilioWorker(env, repo))

	river.AddWorker[osm.TraceFeedIngesterJobArgs](workers, osm.NewTraceFeedIngesterWorker(env, jobs))
	river.AddWorker[osm.TraceDownloaderJobArgs](workers, osm.NewTraceDownloaderWorker(env))

	river.AddWorker[dftbusopendata.JobArgs](workers, dftbusopendata.NewWorker(env))

	river.AddWorker[pmunroaccess.GenerateArgs](workers, pmunroaccess.NewGenerateWorker(env))
	river.AddWorker[pmunroaccess.PregenerationArgs](workers, pmunroaccess.NewPregenerationWorker(env))

	river.AddWorker[pemail.JobArgs](workers, pemail.NewWorker(env))

	periodic.Add(river.NewPeriodicJob(
		mustParseCron("46 18 * * *"),
		func() (river.JobArgs, *river.InsertOpts) {
			return pmunroaccess.PregenerationArgs{}, nil
		},
		nil,
	))

	if env.IsProduction {
		periodic.Add(river.NewPeriodicJob(
			river.PeriodicInterval(time.Hour),
			func() (river.JobArgs, *river.InsertOpts) {
				return osm.TraceFeedIngesterJobArgs{}, nil
			},
			nil,
		))

		// DFT updates timetables daily at 6:00 am and 6:00 pm GMT
		for _, schedule := range []cron.Schedule{
			mustParseCron("30 6 * * *"),
			mustParseCron("30 18 * * *"),
		} {
			periodic.Add(river.NewPeriodicJob(
				schedule,
				func() (river.JobArgs, *river.InsertOpts) {
					return dftbusopendata.JobArgs{}, nil
				},
				nil,
			))
		}
	}
}

func mustParseCron(s string) cron.Schedule {
	value, err := cron.ParseStandard(s)
	if err != nil {
		panic(err)
	}
	return value
}
