package papi

import (
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/pelevation"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
)

type phandler struct {
	*pconfig.Env
	elevation *pelevation.Service
	*prepo.Repo
}
