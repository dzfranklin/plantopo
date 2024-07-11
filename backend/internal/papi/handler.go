package papi

import (
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/pelevation"
)

type phandler struct {
	*pconfig.Config
	elevation *pelevation.Service
}

func NewHandler(cfg *pconfig.Config) Handler {
	return &phandler{
		Config:    cfg,
		elevation: pelevation.New(cfg),
	}
}
