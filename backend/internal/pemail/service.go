package pemail

import (
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/jackc/pgx/v5"
	"github.com/riverqueue/river"
	"time"
)

const (
	fromName    = "PlanTopo"
	fromAddress = "support@plantopo.com"
)

type Service struct {
	jobs *river.Client[pgx.Tx]
}

func NewService(env *pconfig.Env) *Service {
	return &Service{jobs: env.Jobs}
}

type Message struct {
	To      string
	Subject string
	Text    string
}

func (s *Service) Send(msg Message) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_, err := s.jobs.Insert(ctx, JobArgs{Msg: msg}, nil)
	return err
}
