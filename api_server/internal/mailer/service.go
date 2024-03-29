package mailer

import (
	"context"
	"embed"
	"fmt"
	"html/template"
	"net/url"
	"strings"
	texttemplate "text/template"

	"github.com/danielzfranklin/plantopo/api_server/internal/loggers"
	"github.com/danielzfranklin/plantopo/api_server/internal/types"
	"go.uber.org/zap"
)

type Service interface {
	CheckDeliverable(ctx context.Context, email string) (bool, error)
	SendConfirmation(to *types.User, token string) error
	SendPasswordReset(to *types.User, token string) error
	SendShareNotification(req ShareNotificationRequest) error
	SendInvite(req InviteRequest) error
	SendRequestAccess(req RequestAccessRequest) error
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
	l := loggers.FromCtx(ctx).Sugar().Named("mailer")
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
var textTemplates = texttemplate.Must(texttemplate.ParseFS(templatesFS,
	"templates/*.subject.tmpl", "templates/*.text.tmpl",
))

type confirmContext struct {
	FullName   string
	ConfirmUrl string
}

func (m *impl) SendConfirmation(to *types.User, token string) error {
	tdata := confirmContext{
		FullName:   to.FullName,
		ConfirmUrl: "https://plantopo.com/confirm/?token=" + token,
	}
	var subject strings.Builder
	err := textTemplates.ExecuteTemplate(&subject, "confirmation.subject.tmpl", tdata)
	if err != nil {
		return fmt.Errorf("execute confirmation subject template: %w", err)
	}
	var textBody strings.Builder
	err = textTemplates.ExecuteTemplate(&textBody, "confirmation.text.tmpl", tdata)
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
		ConfirmUrl: "https://plantopo.com/login/forgot-password/reset/?token=" + token,
	}
	var subject strings.Builder
	err := textTemplates.ExecuteTemplate(&subject, "password_reset.subject.tmpl", tdata)
	if err != nil {
		return fmt.Errorf("execute password reset subject template: %w", err)
	}
	var textBody strings.Builder
	err = textTemplates.ExecuteTemplate(&textBody, "password_reset.text.tmpl", tdata)
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
	tdata := shareContext{
		FromFullName: req.From.FullName,
		ToFullName:   req.To.FullName,
		MapName:      mapName(*req.Map),
		MapUrl:       template.URL(mapURL(*req.Map)),
		Message:      req.Message,
	}

	var subject strings.Builder
	err := textTemplates.ExecuteTemplate(&subject, "share_notification.subject.tmpl", tdata)
	if err != nil {
		return fmt.Errorf("execute share notification subject template: %w", err)
	}

	var textBody strings.Builder
	err = textTemplates.ExecuteTemplate(&textBody, "share_notification.text.tmpl", tdata)
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
	signupUrl := fmt.Sprintf(
		"https://plantopo.com/signup/?returnTo=%s&email=%s",
		url.QueryEscape(fmt.Sprintf("/map/%s/", req.Map.Id)),
		url.QueryEscape(req.ToEmail),
	)
	tdata := inviteContext{
		ToEmail:      req.ToEmail,
		FromFullName: req.From.FullName,
		MapName:      mapName(*req.Map),
		SignupUrl:    template.URL(signupUrl),
		Message:      req.Message,
	}

	var subject strings.Builder
	err := textTemplates.ExecuteTemplate(&subject, "invite.subject.tmpl", tdata)
	if err != nil {
		return fmt.Errorf("execute share invite template: %w", err)
	}

	var textBody strings.Builder
	err = textTemplates.ExecuteTemplate(&textBody, "invite.text.tmpl", tdata)
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

type requestAccessContext struct {
	FromFullName  string
	ToFullName    string
	MapName       string
	MapURL        template.URL
	GrantURL      template.URL
	RequestedRole string
	Message       string
}

type RequestAccessRequest struct {
	RequestId     string
	From          types.User
	To            types.User
	Map           types.MapMeta
	RequestedRole string
	Message       string
}

func (m *impl) SendRequestAccess(req RequestAccessRequest) error {
	grantURL := fmt.Sprintf("https://plantopo.com/access/?requestId=%s", req.RequestId)
	tdata := requestAccessContext{
		FromFullName:  req.From.FullName,
		ToFullName:    req.To.FullName,
		MapName:       mapName(req.Map),
		RequestedRole: req.RequestedRole,
		MapURL:        template.URL(mapURL(req.Map)),
		GrantURL:      template.URL(grantURL),
		Message:       req.Message,
	}

	var subject strings.Builder
	err := textTemplates.ExecuteTemplate(&subject, "request_access.subject.tmpl", tdata)
	if err != nil {
		return fmt.Errorf("execute request access subject template: %w", err)
	}

	var textBody strings.Builder
	err = textTemplates.ExecuteTemplate(&textBody, "request_access.text.tmpl", tdata)
	if err != nil {
		return fmt.Errorf("execute request access textBody template: %w", err)
	}

	err = m.s.Send(Payload{
		to:       req.To.Email,
		subject:  strings.TrimSpace(subject.String()),
		textBody: textBody.String(),
	})
	if err != nil {
		m.l.Warn("failed to send request access email",
			" from=", req.From.Id, " to=", req.To.Id, zap.Error(err))
		return err
	}

	m.l.Info("sent request access email",
		" from=", req.From.Id, " to=", req.To.Id)
	return nil
}

func mapName(meta types.MapMeta) string {
	if meta.Name != "" {
		return meta.Name
	}
	return "Unnamed map"
}

func mapURL(meta types.MapMeta) string {
	return fmt.Sprintf("https://plantopo.com/map/%s/", meta.Id)
}
