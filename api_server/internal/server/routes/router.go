package routes

import (
	"context"
	"fmt"
	"github.com/danielzfranklin/plantopo/api_server/internal/importers"
	"github.com/danielzfranklin/plantopo/api_server/internal/sync_backends"
	gorillahandlers "github.com/gorilla/handlers"
	"net/http"
	"os"

	api "github.com/danielzfranklin/plantopo/api/v1"
	"github.com/danielzfranklin/plantopo/api_server/internal/frontend_map_tokens"
	"github.com/danielzfranklin/plantopo/api_server/internal/logger"
	"github.com/danielzfranklin/plantopo/api_server/internal/mailer"
	"github.com/danielzfranklin/plantopo/api_server/internal/maps"
	"github.com/danielzfranklin/plantopo/api_server/internal/rid"
	"github.com/danielzfranklin/plantopo/api_server/internal/server/session"
	"github.com/danielzfranklin/plantopo/api_server/internal/users"
	"github.com/danielzfranklin/plantopo/db"
	"github.com/gorilla/mux"
	"go.uber.org/zap"
)

type Services struct {
	Pg                *db.Pg
	Users             users.Service
	Maps              maps.Service
	Mailer            mailer.Service
	SessionManager    *session.Manager
	FrontendMapTokens *frontend_map_tokens.Tokens
	Matchmaker        api.MatchmakerClient
	SyncBackends      *sync_backends.Provider
	MapImporter       MapImporter
}

type MapImporter interface {
	CreateImport(ctx context.Context, req *importers.CreateImportRequest) (*importers.Import, error)
	StartImport(importId string) (*importers.Import, error)
	CheckImport(ctx context.Context, importId string) (*importers.Import, error)
}

func New(s *Services) http.Handler {
	r := mux.NewRouter()
	r.Use(logMiddleware)
	r.Use(corsMiddleware)
	r.NotFoundHandler = http.HandlerFunc(notFoundHandler)
	r.MethodNotAllowedHandler = http.HandlerFunc(notAllowedHandler)

	r.HandleFunc("/api/v1/healthz", s.healthzHandler).Methods("GET")

	r.HandleFunc("/api/dev/httpbin", s.devHttpbinHandler)

	r.HandleFunc("/api/v1/session", s.sessionHandler)

	r.HandleFunc("/api/v1/account/confirm/complete", s.accountConfirmCompleteHandler)
	r.HandleFunc("/api/v1/account/confirm/rerequest", s.accountConfirmRerequestHandler)
	r.HandleFunc("/api/v1/account/register", s.accountRegisterHandler)
	r.HandleFunc("/api/v1/account/password-reset/request", s.requestPasswordResetHandler)
	r.HandleFunc("/api/v1/account/password-reset/check", s.checkPasswordResetHandler)
	r.HandleFunc("/api/v1/account/password-reset/complete", s.completePasswordResetHandler)
	r.HandleFunc("/api/v1/account/profile-png/{id:[a-z0-9-]+}.png", s.accountImageHandler)

	r.HandleFunc("/api/v1/map/tokens", s.mapTokensHandler)

	r.HandleFunc("/api/v1/map/list/owned-by-me", s.mapListOwnedByMeHandler)
	r.HandleFunc("/api/v1/map/list/shared-with-me", s.mapListSharedWithMeHandler)

	r.HandleFunc("/api/v1/map", s.mapsHandler)
	r.HandleFunc("/api/v1/map/{id}", s.mapHandler)
	r.HandleFunc("/api/v1/map/{id}/sync-socket", s.mapSyncSocketHandler)
	r.HandleFunc("/api/v1/map/{id}/access", s.mapAccessHandler)

	r.HandleFunc("/api/v1/map/{mapId}/import", s.uploadImportHandler)
	r.HandleFunc("/api/v1/map/{mapId}/import/{importId}/start", s.startImportHandler)
	r.HandleFunc("/api/v1/map/{mapId}/import/{importId}", s.checkImportHandler)

	if os.Getenv("APP_ENV") == "development" {
		return r
	} else {
		return gorillahandlers.RecoveryHandler(
			gorillahandlers.RecoveryLogger(recoveryLogger{}),
		)(r)
	}
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
		"https://plantopo.com",
		"",
		"http://localhost:3000",
		"https://geder.reindeer-neon.ts.net",
		"http://dev-local.plantopo.com:3000",
		"https://dev-local.plantopo.com:3000",
		"https://dev-local.plantopo.com",
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
			writeError(r, w, &ErrorReply{
				Code:    http.StatusForbidden,
				Message: "origin not allowed",
			})
		}
	})
}

func notFoundHandler(w http.ResponseWriter, r *http.Request) {
	r = rid.RequestWithContext(r)
	logger.FromCtx(r.Context()).Info("no handler", zap.String("path", r.URL.Path))
	writeError(r, w, &ErrorReply{
		Code:    http.StatusNotFound,
		Reason:  "notFound",
		Message: "no handler",
		Details: map[string]interface{}{
			"path":   r.URL.Path,
			"method": r.Method,
		},
	})
}

func notAllowedHandler(w http.ResponseWriter, r *http.Request) {
	r = rid.RequestWithContext(r)
	writeError(r, w, &ErrorReply{
		Code:    http.StatusMethodNotAllowed,
		Reason:  "methodNotAllowed",
		Message: fmt.Sprintf("resource does not permit method %s", r.Method),
	})
}
