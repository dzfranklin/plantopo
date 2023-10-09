package mailer

import (
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/ses"
)

type SESSender struct {
	*ses.SES
	creds *credentials.Credentials
}

func NewSESSender() (*SESSender, error) {
	creds := credentials.NewEnvCredentials()
	sess, err := session.NewSession(&aws.Config{
		Region:      aws.String("eu-west-2"),
		Credentials: creds,
	})
	if err != nil {
		return nil, err
	}
	return &SESSender{ses.New(sess), creds}, nil
}

func (s *SESSender) Send(p Payload) error {
	input := ses.SendEmailInput{
		Source: aws.String("noreply@plantopo.com"),
		Destination: &ses.Destination{
			ToAddresses: []*string{aws.String(p.to)},
		},
		Message: &ses.Message{
			Body: &ses.Body{
				Text: &ses.Content{
					Charset: aws.String("UTF-8"),
					Data:    aws.String(p.textBody),
				},
			},
			Subject: &ses.Content{
				Charset: aws.String("UTF-8"),
				Data:    aws.String(p.subject),
			},
		},
	}
	_, err := s.SES.SendEmail(&input)
	return err
}
