package admin

import (
	"github.com/dzfranklin/plantopo/backend/internal/pemail"
	"net/http"
)

func (app *adminApp) mailGet(w http.ResponseWriter, r *http.Request) {
	app.render(w, r, "mail.tmpl", M{})
}

func (app *adminApp) mailPost(w http.ResponseWriter, r *http.Request) {
	var formData pemail.Message
	if err := app.decodePostForm(r, &formData); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := app.mailer.Send(formData); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	app.render(w, r, "mail.tmpl", M{
		"MailStatus": "Enqueued send!",
	})
}
