package routes

import (
	"net/http"

	"github.com/danielzfranklin/plantopo/logger"
	"github.com/danielzfranklin/plantopo/mapsync"
	"github.com/danielzfranklin/plantopo/server/session"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

type Services struct {
	Matchmaker     *mapsync.Matchmaker
	Redis          *redis.Client
	Postgres       *pgxpool.Pool
	SessionManager *session.SessionManager
}

func New(s *Services) *mux.Router {
	if s.SessionManager == nil {
		s.SessionManager = session.NewManager()
	}

	r := mux.NewRouter()
	r.Use(logMiddleware)

	r.HandleFunc("/healthz", s.healthzHandler).Methods("GET")
	r.HandleFunc("/api/v1/session", s.sessionHandler)

	return r
}

func logMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		l := logger.FromCtx(r.Context()).Named("http")

		requestId := r.Header.Get("X-Request-Id")
		if requestId == "" {
			requestId = uuid.New().String()
		}
		l = l.With(zap.String("requestId", requestId))

		l.Info("request", zap.String("method", r.Method), zap.String("path", r.URL.Path))
		next.ServeHTTP(w, r)
	})
}
