package pmunroaccess

import (
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/riverqueue/river"
	"github.com/uniplaces/carbon"
	"time"
)

type pregeneratedPlace struct {
	name  string
	point [2]float64
}

var pregeneratedPlaces = []pregeneratedPlace{
	{name: "Glasgow Queen Street Station", point: [2]float64{-4.256839, 55.85955}},
	{name: "Edinburgh Haymarket Station", point: [2]float64{-3.2448477, 55.9458219}},
	{name: "Aberdeen Station", point: [2]float64{-2.1035992, 57.1427562}},
	{name: "Dundee Station", point: [2]float64{-2.971971, 56.4576738}},
	{name: "St Andrews", point: [2]float64{-2.8051686, 56.340668}},
}

type PregenerationArgs struct{}

func (a PregenerationArgs) Kind() string {
	return "pregenerate_munro_access"
}

type PregenerationWorker struct {
	s *Service
	river.WorkerDefaults[PregenerationArgs]
}

func NewPregenerationWorker(env *pconfig.Env) *PregenerationWorker {
	s := New(env)
	return &PregenerationWorker{s: s}
}

func (w PregenerationWorker) Timeout(_ *river.Job[PregenerationArgs]) time.Duration {
	return time.Hour * 12
}

func (w PregenerationWorker) Work(ctx context.Context, _ *river.Job[PregenerationArgs]) error {
	var dates []time.Time
	now := carbon.Now()
	if now.Weekday() == time.Saturday {
		// skip on saturdays
		return nil
	}
	dates = append(dates, now.Next(time.Saturday).Time)
	dates = append(dates, now.Next(time.Sunday).Time)

	var ids []string
	for _, place := range pregeneratedPlaces {
		for _, date := range dates {
			status, err := w.s.Request(Request{
				FromLabel: place.name,
				FromPoint: place.point,
				Date:      date,
			})
			if err != nil {
				return err
			}
			ids = append(ids, status.Report.ID)
		}
	}

	var reports []Meta
	for _, id := range ids {
		report, err := w.s.WaitForReady(ctx, id)
		if err != nil {
			return err
		}
		reports = append(reports, report)
	}

	if err := w.s.setPregeneratedReports(ctx, reports); err != nil {
		return err
	}

	w.s.l.Info("pregenerated reports")
	return nil
}
