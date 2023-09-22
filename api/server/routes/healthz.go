package routes

import (
	"encoding/json"
	"net/http"

	"github.com/danielzfranklin/plantopo/api/logger"
	"go.uber.org/zap"
)

type reply struct {
	Healthy  bool            `json:"healthy"`
	Services map[string]bool `json:"services"`
}

func (s *Services) healthzHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	l := logger.FromCtx(ctx).Named("healthzHandler")

	checks := map[string]func() bool{
		"redis": func() bool {
			_, err := s.Redis.Ping(ctx).Result()
			if err != nil {
				l.Error("redis health check failed", zap.Error(err))
			}
			return err == nil
		},
		"matchmaker": func() bool {
			return s.Matchmaker.Healthz(ctx)
		},
		"postgres": func() bool {
			err := s.Pg.Ping(r.Context())
			if err != nil {
				l.Error("postgres health check failed", zap.Error(err))
				return false
			}
			return true
		},
	}

	services := make(map[string]bool)
	hasFailure := false
	for name, checker := range checks {
		value := checker()
		services[name] = value
		hasFailure = hasFailure || !value
	}

	reply := reply{
		Healthy:  !hasFailure,
		Services: services,
	}

	replyJson, err := json.Marshal(reply)
	if err != nil {
		l.DPanic("failed to marshal healthz output", zap.Error(err))
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	if hasFailure {
		w.WriteHeader(http.StatusInternalServerError)
		l.Error("healthz check failed", zap.Any("reply", reply))
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(replyJson)
	w.Write([]byte("\n"))
}
