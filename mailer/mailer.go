package mailer

import (
	"context"
	_ "embed"
	"html/template"
	"strings"
	"time"

	"github.com/danielzfranklin/plantopo/auth"
	"github.com/danielzfranklin/plantopo/db"
	"github.com/danielzfranklin/plantopo/logger"
	"go.uber.org/zap"
)

type IMailer interface {
	SendConfirmationEmail(user auth.User, token string) error
}

type sender interface {
	send(p payload) error
}

type Mailer struct {
	ctx context.Context
	l   *zap.Logger
	pg  *db.Pg
	s   sender
}

type Config struct {
	Pg      *db.Pg
	Workers int // defaults to 1
	sender  sender
}

func New(ctx context.Context, c Config) (*Mailer, error) {
	l := logger.FromCtx(ctx)
	if c.Workers == 0 {
		c.Workers = 1
	}
	if c.sender == nil {
		ses, err := newSESSender()
		if err != nil {
			return nil, err
		}
		c.sender = ses
	}

	m := &Mailer{
		ctx: ctx,
		l:   l,
		pg:  c.Pg,
		s:   c.sender,
	}

	for i := 0; i < c.Workers; i++ {
		l := l.With(zap.Int("worker", i))
		go m.worker(l)
	}

	return m, nil
}

//go:embed templates/confirmation.txt
var confirmationTextTemplateString string
var confirmationTextTemplate = template.Must(template.New("confirmation.txt").Parse(confirmationTextTemplateString))

type confirmationContext struct {
	FullName   string
	ConfirmUrl string
}

func (m *Mailer) SendConfirmationEmail(user auth.User, token string) error {
	var textBody strings.Builder
	err := confirmationTextTemplate.Execute(&textBody, confirmationContext{
		FullName:   user.FullName,
		ConfirmUrl: "https://api.plantopo.com/confirm?token=" + token,
	})
	if err != nil {
		m.l.DPanic("failed to execute template", zap.Error(err))
		return err
	}
	return m.enqueue(
		"confirm:"+token,
		payload{
			to:       user.Email,
			subject:  "Confirm your email - PlanTopo",
			textBody: textBody.String(),
		},
	)
}

type payload struct {
	to       string
	subject  string
	textBody string
}

func (m *Mailer) enqueue(idempotencyKey string, req payload) error {
	_, err := m.pg.Exec(m.ctx,
		`INSERT INTO mailer_jobs
			(idempotency_key, email_to, email_subject, email_text_body)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (idempotency_key) DO NOTHING`,
		idempotencyKey, req.to, req.subject, req.textBody,
	)
	if err != nil {
		m.l.DPanic("failed to insert job", zap.Error(err))
		return err
	}
	_, err = m.pg.Exec(m.ctx, `NOTIFY mailer_jobs`)
	if err != nil {
		m.l.DPanic("failed to notify", zap.Error(err))
		return err
	}
	return nil
}

func (m *Mailer) worker(l *zap.Logger) {
	for {
		job, err := m.claimJob()
		if err != nil {
			time.Sleep(time.Minute)
			continue
		}
		if job != nil {
			err := m.s.send(job.payload)
			if err != nil {
				job.setFailed(err)
			} else {
				job.setSent()
			}
		}

		conn, err := m.pg.Acquire(m.ctx)
		if m.ctx.Err() != nil {
			return
		} else if err != nil {
			l.DPanic("failed to acquire conn", zap.Error(err))
			continue
		}
		for {
			notification, err := conn.Conn().WaitForNotification(m.ctx)
			if m.ctx.Err() != nil {
				return
			} else if err != nil {
				l.DPanic("failed to wait for notification", zap.Error(err))
				time.Sleep(time.Minute)
				break
			} else if notification.Channel == "mailer_jobs" {
				break
			} else {
				continue
			}
		}
	}
}

type pendingJob struct {
	id        int
	payload   payload
	setFailed func(failure error)
	setSent   func()
}

func (m *Mailer) claimJob() (*pendingJob, error) {
	var id int
	var p payload
	err := m.pg.QueryRow(m.ctx,
		`UPDATE mailer_jobs 
			SET claimed_at = NOW()
			WHERE id = (
				SELECT id FROM mailer_jobs
				WHERE claimed_at IS NULL
				ORDER BY created_at ASC
				LIMIT 1
				FOR UPDATE SKIP LOCKED
			)
			RETURNING id, email_to, email_subject, email_text_body`,
	).Scan(&id, &p.to, &p.subject, &p.textBody)
	if err != nil {
		m.l.DPanic("failed to claim job", zap.Error(err))
		return nil, err
	}

	setFailed := func(failure error) {
		_, err := m.pg.Exec(context.Background(),
			`UPDATE mailer_jobs
				SET failed_at = NOW(), failed_reason = $2
				WHERE id = $1`,
			id, failure.Error())
		if err != nil {
			m.l.DPanic("failed to set job failed", zap.Error(err))
		}
	}

	setSent := func() {
		_, err := m.pg.Exec(context.Background(),
			`UPDATE mailer_jobs SET sent_at = NOW() WHERE id = $1`, id)
		if err != nil {
			m.l.DPanic("failed to set sent_at", zap.Error(err))
		}
	}

	return &pendingJob{
		id:        id,
		payload:   p,
		setFailed: setFailed,
		setSent:   setSent,
	}, nil
}
