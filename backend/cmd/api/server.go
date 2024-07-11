package main

import (
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/papi"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"log"
	"net/http"
)

func NewServer(cfg *pconfig.Config) *http.Server {
	apiSrv, err := papi.NewServer(papi.NewHandler(cfg))
	if err != nil {
		log.Fatal(err)
	}

	mux := http.NewServeMux()
	mux.Handle("/docs/", http.StripPrefix("/docs", docsRoutes()))
	mux.Handle("/api/v1/", http.StripPrefix("/api/v1", apiSrv))

	srv := &http.Server{
		Handler: instrumentRequests(recoverPanic(cfg, papi.AssignRequestID(enableCORS(cfg, mux)))),
		Addr:    fmt.Sprintf("0.0.0.0:%d", cfg.Port),
	}

	return srv
}
