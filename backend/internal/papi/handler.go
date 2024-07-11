package papi

import (
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
)

type phandler struct {
	*pconfig.Config
}

func NewHandler(config *pconfig.Config) Handler {
	return &phandler{
		Config: config,
	}
}
