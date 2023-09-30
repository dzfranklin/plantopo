package mailer

import (
	"context"
	"embed"
	"fmt"
	"html/template"
	"net/url"
	"strings"
	text_template "text/template"

	"github.com/danielzfranklin/plantopo/api_server/internal/logger"
	"github.com/danielzfranklin/plantopo/api_server/internal/types"
	"go.uber.org/zap"
)

type Service interface {
	CheckDeliverable(ctx context.Context, email string) (bool, error)
	SendConfirmation(to *types.User, token string) error
	SendPasswordReset(to *types.User, token string) error
	SendShareNotification(req ShareNotificationRequest) error
	SendInvite(req InviteRequest) error
}

type ShareNotificationRequest struct {
	From    *types.User
	To      *types.User
	Map     *types.MapMeta
	Message string
}

type InviteRequest struct {
	From    *types.User
	ToEmail string
	Map     *types.MapMeta
	Message string
}

type impl struct {
	ctx                   context.Context
	l                     *zap.SugaredLogger
	s                     Sender
	deliverabilityChecker DeliverabilityChecker
}

type Config struct {
	Sender                Sender
	DeliverabilityChecker DeliverabilityChecker
}

func New(ctx context.Context, c Config) Service {
	l := logger.FromCtx(ctx).Sugar().Named("mailer")
	if c.Sender == nil {
		l.Fatal("must provide sender")
	}

	return &impl{
		ctx:                   ctx,
		l:                     l,
		s:                     c.Sender,
		deliverabilityChecker: c.DeliverabilityChecker,
	}
}

func NewNoop() Service {
	return New(
		context.Background(),
		Config{
			Sender:                &NoopSender{},
			DeliverabilityChecker: &NoopDeliverabilityChecker{},
		},
	)
}

func (m *impl) CheckDeliverable(ctx context.Context, email string) (bool, error) {
	return m.deliverabilityChecker.CheckDeliverable(ctx, email)
}

//go:embed templates/*
var templatesFS embed.FS
var text_templates = text_template.Must(text_template.ParseFS(templatesFS,
	"templates/*.subject.tmpl", "templates/*.text.tmpl",
))

type confirmContext struct {
	FullName   string
	ConfirmUrl string
}

func (m *impl) SendConfirmation(to *types.User, token string) error {
	tdata := confirmContext{
		FullName:   to.FullName,
		ConfirmUrl: "https://plantopo.com/confirm?token=" + token,
	}
	var subject strings.Builder
	err := text_templates.ExecuteTemplate(&subject, "confirmation.subject.tmpl", tdata)
	if err != nil {
		return fmt.Errorf("execute confirmation subject template: %w", err)
	}
	var textBody strings.Builder
	err = text_templates.ExecuteTemplate(&textBody, "confirmation.text.tmpl", tdata)
	if err != nil {
		return fmt.Errorf("execute confirmation textBody template: %w", err)
	}
	err = m.s.Send(Payload{
		to:       to.Email,
		subject:  strings.TrimSpace(subject.String()),
		textBody: textBody.String(),
	})
	if err != nil {
		m.l.Warn("failed to send confirmation email to", to.Id, zap.Error(err))
		return err
	}
	m.l.Info("sent confirmation email to ", to.Id)
	return nil
}

func (m *impl) SendPasswordReset(to *types.User, token string) error {
	tdata := confirmContext{
		FullName:   to.FullName,
		ConfirmUrl: "https://plantopo.com/login/forgot-password/reset?token=" + token,
	}
	var subject strings.Builder
	err := text_templates.ExecuteTemplate(&subject, "password_reset.subject.tmpl", tdata)
	if err != nil {
		return fmt.Errorf("execute password reset subject template: %w", err)
	}
	var textBody strings.Builder
	err = text_templates.ExecuteTemplate(&textBody, "password_reset.text.tmpl", tdata)
	if err != nil {
		return fmt.Errorf("execute password reset textBody template: %w", err)
	}
	err = m.s.Send(Payload{
		to:       to.Email,
		subject:  strings.TrimSpace(subject.String()),
		textBody: textBody.String(),
	})
	if err != nil {
		m.l.Warn("failed to send password reset email ", "userId=", to.Id, zap.Error(err))
		return err
	}
	m.l.Info("sent password reset email to ", to.Id)
	return nil
}

type shareContext struct {
	FromFullName string
	ToFullName   string
	MapName      string
	MapUrl       template.URL
	Message      string
}

type inviteContext struct {
	ToEmail      string
	FromFullName string
	MapName      string
	SignupUrl    template.URL
	Message      string
}

func (m *impl) SendShareNotification(req ShareNotificationRequest) error {
	mapName := req.Map.Name
	if mapName == "" {
		mapName = "Untitled"
	}
	mapUrl := "https://plantopo.com/map?id=" + req.Map.Id.String()
	tdata := shareContext{
		FromFullName: req.From.FullName,
		ToFullName:   req.To.FullName,
		MapName:      mapName,
		MapUrl:       template.URL(mapUrl),
		Message:      req.Message,
	}

	var subject strings.Builder
	err := text_templates.ExecuteTemplate(&subject, "share_notification.subject.tmpl", tdata)
	if err != nil {
		return fmt.Errorf("execute share notification subject template: %w", err)
	}

	var textBody strings.Builder
	err = text_templates.ExecuteTemplate(&textBody, "share_notification.text.tmpl", tdata)
	if err != nil {
		return fmt.Errorf("execute share notification textBody template: %w", err)
	}

	err = m.s.Send(Payload{
		to:       req.To.Email,
		subject:  strings.TrimSpace(subject.String()),
		textBody: textBody.String(),
	})
	if err != nil {
		m.l.Warn("failed to send share notification email",
			" from=", req.From.Id, " to=", req.To.Id, zap.Error(err))
		return err
	}

	m.l.Info("sent share notification email",
		" from=", req.From.Id,
		" to=", req.To.Id,
	)

	return nil
}

func (m *impl) SendInvite(req InviteRequest) error {
	mapName := req.Map.Name
	if mapName == "" {
		mapName = "Untitled"
	}
	signupUrl := fmt.Sprintf(
		"https://plantopo.com/signup?returnTo=%s&email=%s",
		url.QueryEscape(fmt.Sprintf("/map?id=%s", req.Map.Id)),
		url.QueryEscape(req.ToEmail),
	)
	tdata := inviteContext{
		ToEmail:      req.ToEmail,
		FromFullName: req.From.FullName,
		MapName:      mapName,
		SignupUrl:    template.URL(signupUrl),
		Message:      req.Message,
	}

	var subject strings.Builder
	err := text_templates.ExecuteTemplate(&subject, "invite.subject.tmpl", tdata)
	if err != nil {
		return fmt.Errorf("execute share invite template: %w", err)
	}

	var textBody strings.Builder
	err = text_templates.ExecuteTemplate(&textBody, "invite.text.tmpl", tdata)
	if err != nil {
		return fmt.Errorf("execute share invite textBody template: %w", err)
	}

	err = m.s.Send(Payload{
		to:       req.ToEmail,
		subject:  strings.TrimSpace(subject.String()),
		textBody: textBody.String(),
	})
	if err != nil {
		m.l.Warn("failed to send invite email",
			" from=", req.From.Id, zap.Error(err))
		return err
	}

	m.l.Info("sent invite email", " from=", req.From.Id)

	return nil
}
