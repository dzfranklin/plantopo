package admin

import "net/http"

func (app *adminApp) toolsGet(w http.ResponseWriter, r *http.Request) {
	app.render(w, r, "tools.tmpl", nil)
}
