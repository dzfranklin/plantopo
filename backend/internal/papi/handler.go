package papi

import (
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/pelevation"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/dzfranklin/plantopo/backend/internal/pweather"
)

type phandler struct {
	*pconfig.Env
	*prepo.Repo
	elevation *pelevation.Service
	weather   *pweather.Service
}
