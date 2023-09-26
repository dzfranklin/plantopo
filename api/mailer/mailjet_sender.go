package mailer

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/mailjet/mailjet-apiv3-go/v4"
	"go.uber.org/zap"
)

type MailjetSender struct {
	m          *mailjet.Client
	l          *zap.SugaredLogger
	errorCount int
}

type MailjetCredentials struct {
	Public  string `json:"public"`
	Private string `json:"private"`
}

func ParseMailjetCredentials(creds string) (*MailjetCredentials, error) {
	var c MailjetCredentials
	err := json.Unmarshal([]byte(creds), &c)
	return &c, err
}

func NewMailjetSender(
	l *zap.SugaredLogger, creds *MailjetCredentials,
) *MailjetSender {
	return &MailjetSender{
		m: mailjet.NewMailjetClient(creds.Public, creds.Private),
		l: l.Named("MailjetSender"),
	}
}

func (s *MailjetSender) Send(payload Payload) error {
	if s.errorCount > 10 {
		s.l.Errorw("too many errors, not sending mail",
			"errorCount", s.errorCount)
		return fmt.Errorf("to many mailjet errors")
	}

	req := &mailjet.MessagesV31{
		Info: []mailjet.InfoMessagesV31{{
			From: &mailjet.RecipientV31{
				Email: "daniel@plantopo.com",
				Name:  "PlanTopo",
			},
			To: &mailjet.RecipientsV31{
				mailjet.RecipientV31{
					Email: payload.to,
				},
			},
			Subject:  payload.subject,
			TextPart: payload.textBody,
		}},
	}
	s.l.Debug("sending to mailjet", "req", req)
	resp, err := s.m.SendMailV31(req)
	s.l.Debug("mailjet response", "resp", resp, "error", err)

	if err != nil {
		var apiFeedbackErr *mailjet.APIFeedbackErrorsV31
		if errors.As(err, &apiFeedbackErr) {
			for _, message := range apiFeedbackErr.Messages {
				for _, err := range message.Errors {
					switch err.ErrorIdentifier {
					case "mj-0013":
						s.l.Infow("invalid email address",
							"email", payload.to,
							"subject", payload.subject,
						)
					default:
						s.l.Errorw("mailjet error", "error", err,
							"prevErrorCount", s.errorCount)
						s.errorCount++
					}
				}
			}
		}
		return err
	}

	return nil
}
