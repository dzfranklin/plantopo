package pemail

import (
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/riverqueue/river"
	"github.com/wneessen/go-mail"
	"log/slog"
)

type JobArgs struct {
	Msg Message
}

func (j JobArgs) Kind() string {
	return "email"
}

type Worker struct {
	isProduction bool
	c            *mail.Client
	l            *slog.Logger
	river.WorkerDefaults[JobArgs]
}

func NewWorker(env *pconfig.Env) *Worker {
	if env.IsProduction {
		cfg := &env.Config.SMTPRelay
		c, err := mail.NewClient(cfg.Server, mail.WithPort(cfg.Port),
			mail.WithSMTPAuth(mail.SMTPAuthLogin), mail.WithUsername(cfg.Username), mail.WithPassword(cfg.Password))
		if err != nil {
			panic(err)
		}
		return &Worker{isProduction: true, c: c, l: env.Logger}
	} else {
		return &Worker{isProduction: false, l: env.Logger}
	}
}

func (w *Worker) Work(ctx context.Context, job *river.Job[JobArgs]) error {
	msg := job.Args.Msg

	if !w.isProduction {
		w.l.Info("would mail in prod", "to", msg.To, "subject", msg.Subject, "text", msg.Text)
		return nil
	}

	m := mail.NewMsg()
	if err := m.FromFormat(fromName, fromAddress); err != nil {
		return err
	}
	if err := m.To(msg.To); err != nil {
		return err
	}
	m.Subject(msg.Subject)
	m.SetBodyString(mail.TypeTextPlain, msg.Text)
	return w.c.DialAndSendWithContext(ctx, m)
}
