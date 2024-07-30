package papi

import (
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/pelevation"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/dzfranklin/plantopo/backend/internal/pweather"
)

func New(env *pconfig.Env, repo *prepo.Repo) (*Server, error) {
	h := &phandler{
		Env:       env,
		Repo:      repo,
		elevation: pelevation.New(env),
		weather:   pweather.New(env),
	}
	s := &psecurity{
		Env:  env,
		Repo: repo,
	}
	return NewServer(h, s, WithMiddleware(setClientInfoMiddleware))
}
