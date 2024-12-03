package admin

import (
	"net/http"
)

func (app *adminApp) loginGet(w http.ResponseWriter, r *http.Request) {
	app.renderIsolatedTemplate(w, r, "login.tmpl", M{
		"isLoggedInButNotAdmin": app.checkIsLoggedInButNotAdmin(r),
	})
}
