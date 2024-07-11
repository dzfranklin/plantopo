package main

import (
	"encoding/json"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/papi"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/urfave/negroni"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

func enableCORS(cfg *pconfig.Config, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Vary", "Origin")
		w.Header().Add("Vary", "Access-Control-Request-Method")

		origin := r.Header.Get("Origin")
		if corsShouldAllow(cfg, origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)

			if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
				w.Header().Set("Access-Control-Allow-Methods", "OPTIONS, PUT, PATCH, DELETE")
				w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
				w.WriteHeader(http.StatusOK)
				return
			}
		}

		next.ServeHTTP(w, r)
	})
}

func corsShouldAllow(cfg *pconfig.Config, origin string) bool {
	if origin != "" {
		originURL, err := url.Parse(origin)
		if err != nil {
			cfg.Logger.Warn("failed to parse Origin as url", "error", err, "origin", origin)
			return false
		}
		originHost := originURL.Host
		if strings.Contains(originHost, ":") {
			originHost, _, err = net.SplitHostPort(originHost)
			if err != nil {
				cfg.Logger.Warn("failed to parse Origin host/port", "error", err, "origin", origin)
				return false
			}
		}

		for _, candidate := range cfg.CORSAllowHosts {
			if originHost == candidate {
				return true
			}
		}
	}
	return false
}

func recoverPanic(cfg *pconfig.Config, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				resp := papi.HandleErrorResponse(cfg, r.Context(), fmt.Errorf("panic: %s", err))

				w.Header().Set("Connection", "close")
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(resp.StatusCode)

				js, err := json.Marshal(resp.Response)
				if err != nil {
					cfg.Logger.Error("Failed to marshal error response",
						"error", err,
						"response", fmt.Sprintf("%+v", resp))
					return
				}
				_, _ = w.Write(js)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

var requestStatusCounter = promauto.NewCounterVec(prometheus.CounterOpts{
	Namespace: "pt",
	Name:      "request_status",
}, []string{"code", "path"})

func instrumentRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		spy := negroni.NewResponseWriter(w)
		next.ServeHTTP(spy, r)

		status := spy.Status()
		if status == 0 {
			status = 200
		}

		requestStatusCounter.WithLabelValues(strconv.Itoa(status), r.URL.Path).Inc()
	})
}
