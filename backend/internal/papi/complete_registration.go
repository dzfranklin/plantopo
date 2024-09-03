package papi

import (
	"bytes"
	_ "embed"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"html/template"
	"log/slog"
	"net/http"
)

//go:embed complete_registration.html.tmpl
var completeRegistrationTemplateData string

var completeRegistrationTemplate *template.Template

func init() {
	completeRegistrationTemplate = template.Must(
		template.New("complete_registration.html.tmpl").
			Parse(completeRegistrationTemplateData))
}

func (h *phandler) CompleteRegistrationGet(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" {
		http.Error(w, "Not Found", http.StatusNotFound)
		return
	}

	status, err := h.Users.VerifyEmail(token)
	if err != nil {
		h.Logger.Error("failed to verify email", "error", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	slog.Info("complete registration", "status", status)

	var isSuccess bool
	var message string
	switch status {
	case prepo.VerificationSuccess:
		isSuccess = true
		message = "Your email is now verified"
	case prepo.VerificationTokenExpired:
		message = "This verification email has expired"
	case prepo.VerificationTokenAlreadyUsed:
		isSuccess = true
		message = "Your email was already verified"
	case prepo.VerificationTokenInvalid:
		message = "Invalid url"
	default:
		panic("unreachable")
	}

	var out bytes.Buffer
	err = completeRegistrationTemplate.Execute(&out, map[string]any{
		"IsSuccess": isSuccess,
		"Message":   message,
	})
	if err != nil {
		panic(err)
	}

	_, _ = w.Write(out.Bytes())
}
