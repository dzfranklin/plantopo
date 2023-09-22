package mailer

import "go.uber.org/zap"

type Sender interface {
	Send(p Payload) error
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

type NoopSender struct{}

func (s *NoopSender) Send(p Payload) error {
	return nil
}
