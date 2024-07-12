package admin

import (
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"net/http"
)

func (app *adminApp) sessionsGet(w http.ResponseWriter, r *http.Request) {
	userQuery := r.URL.Query().Get("user")
	var sessions []prepo.SessionInfo
	if userQuery != "" {
		var err error
		sessions, err = app.Sessions.ListSessionsByUser(userQuery)
		if err != nil {
			app.internalServerError(w, r, err)
			return
		}
	}
	app.render(w, r, "sessions.tmpl", M{
		"UserQuery": userQuery,
		"Sessions":  sessions,
	})
}
