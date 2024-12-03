package admin

import (
	"net/http"
)

func (app *adminApp) loginGet(w http.ResponseWriter, r *http.Request) {
	isLoggedInButNotAdmin, isLoggedInErr := app.checkIsLoggedInButNotAdmin(r)
	if isLoggedInErr != nil {
		app.internalServerError(w, r, isLoggedInErr)
		return
	}

	app.renderIsolatedTemplate(w, r, "login.tmpl", M{
		"isLoggedInButNotAdmin": isLoggedInButNotAdmin,
	})
}
