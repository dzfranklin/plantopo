package routes

import (
	"fmt"
	"net/http"

	"github.com/danielzfranklin/plantopo/api/db"
	"github.com/danielzfranklin/plantopo/api/frontend_map_tokens"
	"github.com/danielzfranklin/plantopo/api/logger"
	"github.com/danielzfranklin/plantopo/api/map_sync"
	"github.com/danielzfranklin/plantopo/api/maps"
	"github.com/danielzfranklin/plantopo/api/rid"
	"github.com/danielzfranklin/plantopo/api/server/session"
	"github.com/danielzfranklin/plantopo/api/users"
	gorilla_handlers "github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

type Services struct {
	Matchmaker        *map_sync.Matchmaker
	Redis             *redis.Client
	Pg                *db.Pg
	Users             users.Service
	Maps              maps.Service
	SessionManager    *session.SessionManager
	FrontendMapTokens *frontend_map_tokens.Tokens
}

func New(s *Services) http.Handler {
	if s.SessionManager == nil {
		s.SessionManager = session.NewManager(s.Users)
	}
	if s.FrontendMapTokens == nil {
		value, err := frontend_map_tokens.FromOs()
		if err != nil {
			logger.Get().Fatal("failed to get frontend map tokens", zap.Error(err))
		}
		s.FrontendMapTokens = value
	}

	r := mux.NewRouter()
	r.Use(logMiddleware)
	r.Use(corsMiddleware)
	r.NotFoundHandler = http.HandlerFunc(notFoundHandler)
	r.MethodNotAllowedHandler = http.HandlerFunc(notAllowedHandler)

	r.HandleFunc("/healthz", s.healthzHandler).Methods("GET")

	r.HandleFunc("/api/v1/session", s.sessionHandler)

	r.HandleFunc("/api/v1/account/confirm/complete", s.accountConfirmCompleteHandler)
	r.HandleFunc("/api/v1/account/confirm/rerequest", s.accountConfirmRerequestHandler)
	r.HandleFunc("/api/v1/account/register", s.accountRegisterHandler)
	r.HandleFunc("/api/v1/account/password-reset/request", s.requestPasswordResetHandler)
	r.HandleFunc("/api/v1/account/password-reset/check", s.checkPasswordResetHandler)
	r.HandleFunc("/api/v1/account/password-reset/complete", s.completePasswordResetHandler)
	r.HandleFunc("/api/v1/account/{id:[a-z0-9-]+}.png", s.accountImageHandler)

	r.HandleFunc("/api/v1/map/tokens", s.mapTokensHandler)

	r.HandleFunc("/api/v1/map/list/owned-by-me", s.mapListOwnedByMeHandler)
	r.HandleFunc("/api/v1/map/list/shared-with-me", s.mapListSharedWithMeHandler)

	r.HandleFunc("/api/v1/map", s.mapsHandler)
	r.HandleFunc("/api/v1/map/{id}", s.mapHandler)
	r.HandleFunc("/api/v1/map/{id}/sync-socket", s.mapSyncSocketHandler)
	r.HandleFunc("/api/v1/map/{id}/access", s.mapAccessHandler)

	return gorilla_handlers.RecoveryHandler(
		gorilla_handlers.RecoveryLogger(recoveryLogger{}),
	)(r)
}

type recoveryLogger struct{}

func (l recoveryLogger) Println(v ...interface{}) {
	logger.Get().Error("panic in handler", zap.Any("v", v))
}

func logMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r = rid.RequestWithContext(r)

		l := logger.FromCtx(r.Context()).With(
			zap.String("method", r.Method),
			zap.String("path", r.URL.Path),
			zap.String("query", r.URL.RawQuery),
			zap.String("origin", r.Header.Get("Origin")),
		)

		l.Info("request",
			zap.String("userAgent", r.UserAgent()),
			zap.Bool("hasRidHeader", rid.HasHeader(r)))

		next.ServeHTTP(w, r.WithContext(logger.WithCtx(r.Context(), l)))
	})
}

var (
	allowedOrigins = []string{
		"http://localhost:3000",
		"https://plantopo.com",
		"",
	}
	allowedMethods = "GET, PUT, POST, DELETE, HEAD, OPTIONS"
	allowedHeaders = "Content-Type, X-Request-Id"
)

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		permit := false
		for _, allowedOrigin := range allowedOrigins {
			if origin == allowedOrigin {
				permit = true
				break
			}
		}

		if permit {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", allowedMethods)
			w.Header().Set("Access-Control-Allow-Headers", allowedHeaders)
			w.Header().Set("Access-Control-Allow-Credentials", "true")

			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
			} else {
				next.ServeHTTP(w, r)
			}
		} else {
			writeError(w, &ErrorReply{
				Code:    http.StatusForbidden,
				Details: "origin not allowed",
			})
		}
	})
}

func notFoundHandler(w http.ResponseWriter, r *http.Request) {
	writeError(w, &ErrorReply{
		Code:    http.StatusNotFound,
		Reason:  "notFound",
		Message: "no handler",
	})
}

func notAllowedHandler(w http.ResponseWriter, r *http.Request) {
	writeError(w, &ErrorReply{
		Code:    http.StatusMethodNotAllowed,
		Reason:  "methodNotAllowed",
		Message: fmt.Sprintf("resource does not permit method %s", r.Method),
	})
}
