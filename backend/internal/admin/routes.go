package admin

import (
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/pemail"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/go-playground/form"
	"net/http"
	"riverqueue.com/riverui"
)

func Routes(env *pconfig.Env) http.Handler {
	repo := prepo.New(env)
	app := adminApp{
		Env:         env,
		Repo:        repo,
		mailer:      pemail.NewService(env),
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
	mux.HandleFunc("GET /admin/tools", app.toolsGet)
	mux.HandleFunc("GET /admin/sessions", app.sessionsGet)
	mux.HandleFunc("GET /admin/auditlog", app.auditlogGet)
	mux.HandleFunc("GET /admin/auditlog/{id}", app.auditlogEntryGet)
	mux.HandleFunc("GET /admin/tel-input", app.telInput)
	mux.HandleFunc("GET /admin/authorized-sms-sender", app.authorizedSMSSendersGet)
	mux.HandleFunc("GET /admin/authorized-sms-sender/{id}", app.authorizedSMSSenderGet)
	mux.HandleFunc("GET /admin/mail", app.mailGet)
	mux.HandleFunc("POST /admin/mail", app.mailPost)
	mux.HandleFunc("GET /admin/fire-job", app.fireJobGet)
	mux.HandleFunc("POST /admin/fire-job", app.fireJobPost)
	mux.HandleFunc("/admin/review-british-and-irish-hill-photos", app.reviewBritishAndIrishHillPhotos)
	mux.HandleFunc("GET /admin/geophotos/flickr-regions", app.geophotosFlickrRegionsGet)

	riverSrv, err := riverui.NewServer(&riverui.ServerOpts{
		Client: env.Jobs,
		DB:     env.DB,
		Logger: env.Logger.With("app", "riverui"),
		Prefix: "/admin/river",
	})
	if err != nil {
		panic(err)
	}
	mux.Handle("/admin/river/", riverSrv)

	return app.requireAdminExceptLoginPageMiddleware(mux)
}

func (app *adminApp) indexGet(w http.ResponseWriter, r *http.Request) {
	app.render(w, r, "index.tmpl", M{})
}
