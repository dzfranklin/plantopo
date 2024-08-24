package pemail

import (
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/riverqueue/river"
	"github.com/wneessen/go-mail"
)

type JobArgs struct {
	Msg Message
}

func (j JobArgs) Kind() string {
	return "email"
}

type Worker struct {
	c *mail.Client
	river.WorkerDefaults[JobArgs]
}

func NewWorker(env *pconfig.Env) *Worker {
	cfg := &env.Config.SMTPRelay
	c, err := mail.NewClient(cfg.Server, mail.WithPort(cfg.Port),
		mail.WithSMTPAuth(mail.SMTPAuthLogin), mail.WithUsername(cfg.Username), mail.WithPassword(cfg.Password))
	if err != nil {
		panic(err)
	}
	return &Worker{c: c}
}

func (w *Worker) Work(ctx context.Context, job *river.Job[JobArgs]) error {
	m := mail.NewMsg()
	if err := m.FromFormat(fromName, fromAddress); err != nil {
		return err
	}
	if err := m.To(job.Args.Msg.To); err != nil {
		return err
	}
	m.Subject(job.Args.Msg.Subject)
	m.SetBodyString(mail.TypeTextPlain, job.Args.Msg.Text)
	return w.c.DialAndSendWithContext(ctx, m)
}
