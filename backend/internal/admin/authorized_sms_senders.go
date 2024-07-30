package admin

import (
	"errors"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"net/http"
)

func (app *adminApp) authorizedSMSSendersGet(w http.ResponseWriter, r *http.Request) {
	entries, err := app.AuthorizedSMSSenders.ListAll()
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	app.render(w, r, "authorized_sms_senders.tmpl", M{"Entries": entries})
}

func (app *adminApp) authorizedSMSSenderGet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	entry, err := app.AuthorizedSMSSenders.Get(id)
	if err != nil {
		if errors.Is(err, prepo.ErrNotFound) || errors.Is(err, prepo.ErrInvalidID) {
			app.clientError(w, http.StatusNotFound)
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	app.render(w, r, "authorized_sms_sender.tmpl", M{"Entry": entry})
}
