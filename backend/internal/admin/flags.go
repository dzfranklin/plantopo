package admin

import (
	"net/http"
)

func (app *adminApp) handleFlags(w http.ResponseWriter, r *http.Request) {
	if r.Method == "POST" {
		var formData struct {
			Action string
			Key    string
			Value  bool
		}
		if err := app.decodePostForm(r, &formData); err != nil {
			app.clientError(w, http.StatusBadRequest)
			return
		}

		var actionErr error
		switch formData.Action {
		case "set":
			actionErr = app.SetBoolFlag(formData.Key, formData.Value)
		case "delete":
			actionErr = app.DeleteBoolFlag(formData.Key)
		default:
			app.clientError(w, http.StatusBadRequest)
			return
		}
		if actionErr != nil {
			app.internalServerError(w, r, actionErr)
			return
		}
	}

	boolFlags := app.ListBoolFlags()

	app.render(w, r, "flags.tmpl", M{
		"BoolFlags": boolFlags,
	})
}
