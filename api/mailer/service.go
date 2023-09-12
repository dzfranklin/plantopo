package mailer

import (
	"context"
	"embed"
	"html/template"
	"strings"

	"github.com/danielzfranklin/plantopo/api/logger"
	"github.com/danielzfranklin/plantopo/api/user"
	"go.uber.org/zap"
)

type Service interface {
	SendConfirmation(user user.User, token string) error
}

type impl struct {
	ctx context.Context
	l   *zap.Logger
	s   sender
}

type Config struct {
	sender sender
}

func New(ctx context.Context, c Config) (*impl, error) {
	l := logger.FromCtx(ctx)
	if c.sender == nil {
		ses, err := newSESSender()
		if err != nil {
			return nil, err
		}
		c.sender = ses
	}

	return &impl{
		ctx: ctx,
		l:   l,
		s:   c.sender,
	}, nil
}

type sender interface {
	send(p payload) error
}

type payload struct {
	to       string
	subject  string
	textBody string
}

//go:embed templates/*
var templatesFS embed.FS
var templates = template.Must(template.ParseFS(templatesFS, "templates/*"))

type confirmationContext struct {
	FullName   string
	ConfirmUrl string
}

func (m *impl) SendConfirmation(user user.User, token string) error {
	tdata := confirmationContext{
		FullName:   user.FullName,
		ConfirmUrl: "https://api.plantopo.com/confirm?token=" + token,
	}
	var subject strings.Builder
	err := templates.ExecuteTemplate(&subject, "confirmation.subject.tmpl", tdata)
	if err != nil {
		m.l.DPanic("failed to execute template", zap.Error(err))
		return err
	}
	var textBody strings.Builder
	err = templates.ExecuteTemplate(&textBody, "confirmation.text.tmpl", tdata)
	if err != nil {
		m.l.DPanic("failed to execute template", zap.Error(err))
		return err
	}
	err = m.s.send(payload{
		to:       user.Email,
		subject:  strings.TrimSpace(subject.String()),
		textBody: textBody.String(),
	})
	if err != nil {
		m.l.Warn("failed to send confirmation email",
			zap.String("user.id", user.Id.String()), zap.Error(err))
		return err
	}
	m.l.Info("sent confirmation email",
		zap.String("user.id", user.Id.String()))
	return nil
}
