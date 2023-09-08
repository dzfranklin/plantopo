package routes

import (
	"encoding/json"
	"net/http"

	"github.com/danielzfranklin/plantopo/logger"
	"go.uber.org/zap"
)

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
		"postgres": func() bool { return true }, // TODO:
	}

	output := make(map[string]bool)
	hasFailure := false
	for name, checker := range checks {
		value := checker()
		output[name] = value
		hasFailure = hasFailure || !value
	}

	outputJson, err := json.Marshal(output)
	if err != nil {
		l.DPanic("failed to marshal healthz output", zap.Error(err))
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	if hasFailure {
		w.WriteHeader(http.StatusInternalServerError)
		l.Error("healthz check failed", zap.ByteString("output", outputJson))
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(outputJson)
	w.Write([]byte("\n"))
}
