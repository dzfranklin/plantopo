package admin

import (
	"errors"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"net/http"
)

func (app *adminApp) usersGet(w http.ResponseWriter, r *http.Request) {
	queryCursor := r.URL.Query().Get("cursor")
	users, cursor, err := app.Users.List(queryCursor)
	if err != nil {
		if errors.Is(err, prepo.ErrInvalidCursor) {
			app.clientError(w, http.StatusBadRequest)
			return
		}
		app.internalServerError(w, r, err)
		return
	}
	app.render(w, r, "users.tmpl", M{
		"Users":  users,
		"Cursor": cursor,
	})
}

func (app *adminApp) userGet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	user, err := app.Users.Get(id)
	if err != nil {
		if errors.Is(err, prepo.ErrInvalidID) || errors.Is(err, prepo.ErrNotFound) {
			app.clientError(w, http.StatusNotFound)
			return
		}
		app.internalServerError(w, r, err)
		return
	}
	app.render(w, r, "user.tmpl", M{
		"User": user,
	})
}
