package papi

import (
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/pelevation"
	"github.com/dzfranklin/plantopo/backend/internal/pimg"
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
	img         *pimg.Config
}

func New(env *pconfig.Env, repo *prepo.Repo) (http.Handler, error) {
	mux := http.NewServeMux()

	h := &phandler{
		Env:         env,
		Repo:        repo,
		elevation:   pelevation.New(env),
		weather:     pweather.New(env),
		munroaccess: pmunroaccess.New(env),
		img:         pimg.New(env.Config.Imgproxy.Key, env.Config.Imgproxy.Salt),
	}

	s := &psecurity{
		Env:  env,
		Repo: repo,
	}

	srv, err := NewServer(h, s, WithMiddleware(setClientInfoMiddleware))
	if err != nil {
		return nil, err
	}
	mux.Handle("/", srv)

	mux.HandleFunc("/munro-access/report/{id}/status-updates", h.MunroAccessReportIDStatusUpdatesGet)

	return mux, nil
}
