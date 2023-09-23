package mailer

import (
	"context"

	"go.uber.org/zap"
)

type Sender interface {
	Send(p Payload) error
	Healthz(ctx context.Context) bool
}

type Payload struct {
	to       string
	subject  string
	textBody string
}

type LogSender struct{ Logger *zap.SugaredLogger }

func (s *LogSender) Send(p Payload) error {
	s.Logger.Info("LogSender", zap.Any("payload", p))
	return nil
}

func (s *LogSender) Healthz(ctx context.Context) bool {
	return true
}

type NoopSender struct{}

func (s *NoopSender) Send(p Payload) error {
	return nil
}

func (s *NoopSender) Healthz(ctx context.Context) bool {
	return true
}
