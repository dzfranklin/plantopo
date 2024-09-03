package pemail

import (
	"embed"
	"strings"
	textTemplate "text/template"
)

//go:embed templates
var templateFS embed.FS

var subjectTemplates *textTemplate.Template
var textTemplates *textTemplate.Template

func init() {
	subjectTemplates = textTemplate.Must(textTemplate.ParseFS(templateFS, "templates/*.subject.tmpl"))
	textTemplates = textTemplate.Must(textTemplate.ParseFS(templateFS, "templates/*.text.tmpl"))
}

type M map[string]any

func CompleteRegistrationEmail(to string, verificationLink string) Message {
	return templateMessage("complete-registration", to, M{"VerificationLink": verificationLink})
}

func templateMessage(name string, to string, data M) Message {
	var subjectB strings.Builder
	if err := subjectTemplates.ExecuteTemplate(&subjectB, name+".subject.tmpl", data); err != nil {
		panic(err)
	}
	subject := strings.TrimSpace(subjectB.String())

	var textB strings.Builder
	if err := textTemplates.ExecuteTemplate(&textB, name+".text.tmpl", data); err != nil {
		panic(err)
	}
	text := strings.TrimSpace(textB.String()) + "\n"

	return Message{To: to, Subject: subject, Text: text}
}
