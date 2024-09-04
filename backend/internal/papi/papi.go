package papi

import (
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/pelevation"
	"github.com/dzfranklin/plantopo/backend/internal/pmunroaccess"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/dzfranklin/plantopo/backend/internal/pweather"
	"net/http"
)

type phandler struct {
	*pconfig.Env
	*prepo.Repo
	elevation   *pelevation.Service
	weather     *pweather.Service
	munroaccess *pmunroaccess.Service
}

func New(env *pconfig.Env) (http.Handler, error) {
	mux := http.NewServeMux()

	repo := prepo.New(env)
	h := &phandler{
		Env:         env,
		Repo:        repo,
		elevation:   pelevation.New(env),
		weather:     pweather.New(env),
		munroaccess: pmunroaccess.New(env),
	}

	s := &psecurity{
		Env:  env,
		Repo: repo,
	}

	srv, err := NewServer(h, s, WithMiddleware(h.setClientInfoMiddleware))
	if err != nil {
		return nil, err
	}
	mux.Handle("/", srv)

	mux.HandleFunc("/complete-registration", h.CompleteRegistrationGet)
	mux.HandleFunc("/munro-access/report/{id}/status-updates", h.MunroAccessReportIDStatusUpdatesGet)

	return mux, nil
}
