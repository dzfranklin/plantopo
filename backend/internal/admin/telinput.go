package admin

import "net/http"

func (app *adminApp) telInput(w http.ResponseWriter, r *http.Request) {
	app.render(w, r, "telinput.tmpl", nil)
}
