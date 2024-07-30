package admin

import (
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/go-playground/form"
	"net/http"
)

func Routes(env *pconfig.Env, repo *prepo.Repo) http.Handler {
	app := adminApp{
		Env:         env,
		Repo:        repo,
		formDecoder: form.NewDecoder(),
	}

	mux := http.NewServeMux()

	mux.HandleFunc("GET /admin/{$}", app.indexGet)
	mux.HandleFunc("GET /admin/go/{id}", app.goGet)
	mux.HandleFunc("GET /admin/status", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("OK"))
	})
	mux.HandleFunc("GET /admin/login", app.loginGet)
	mux.HandleFunc("GET /admin/users", app.usersGet)
	mux.HandleFunc("GET /admin/user/{id}", app.userGet)
	mux.HandleFunc("GET /admin/sessions", app.sessionsGet)
	mux.HandleFunc("GET /admin/auditlog", app.auditlogGet)
	mux.HandleFunc("GET /admin/auditlog/{id}", app.auditlogEntryGet)
	mux.HandleFunc("GET /admin/tel-input", app.telInput)
	mux.HandleFunc("GET /admin/authorized-sms-sender", app.authorizedSMSSendersGet)
	mux.HandleFunc("GET /admin/authorized-sms-sender/{id}", app.authorizedSMSSenderGet)

	return app.requireAdminExceptLoginPageMiddleware(mux)
}

func (app *adminApp) indexGet(w http.ResponseWriter, r *http.Request) {
	app.render(w, r, "index.tmpl", M{})
}
