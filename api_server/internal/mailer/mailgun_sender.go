package mailer

import (
	"context"

	"github.com/mailgun/mailgun-go/v4"
	"go.uber.org/zap"
)

type MailgunSender struct {
	m        mailgun.Mailgun
	l        *zap.SugaredLogger
	errCount int
}

var mailgunDomain = "mg.plantopo.com"

func NewMailgunSender(
	l *zap.SugaredLogger, key string,
) *MailgunSender {
	m := mailgun.NewMailgun(mailgunDomain, key)
	m.SetAPIBase(mailgun.APIBaseEU)
	return &MailgunSender{
		m: m,
		l: l.Named("MailgunSender"),
	}
}

func (s *MailgunSender) Send(payload Payload) error {
	if s.errCount > 10 {
		s.l.Errorw("too many errors, not sending mail",
			"errorCount", s.errCount)
		return nil
	}

	msg := s.m.NewMessage(
		"PlanTopo <daniel@plantopo.com>",
		payload.subject,
		payload.textBody,
		payload.to,
	)
	status, id, err := s.m.Send(context.Background(), msg)
	if err != nil {
		s.l.Errorw("error sending mail", zap.Error(err))
		s.errCount++
		return err
	}
	s.l.Infow("sent mail", "status", status, "id", id)
	return nil
}
