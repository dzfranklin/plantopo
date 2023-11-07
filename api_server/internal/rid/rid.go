// Package rid handles the request id context
package rid

import (
	"context"
	"net/http"

	"github.com/danielzfranklin/plantopo/api_server/internal/loggers"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type ctxKey struct{}

func FromCtx(ctx context.Context) uuid.UUID {
	if rid, ok := ctx.Value(ctxKey{}).(uuid.UUID); ok {
		return rid
	}
	panic("expected rid (request id) to be in context")
}

func RequestWithContext(r *http.Request) *http.Request {
	l := loggers.FromCtx(r.Context()).Sugar()

	var value uuid.UUID
	headerValue := r.Header.Get("X-Request-Id")
	if headerValue != "" {
		var err error
		value, err = uuid.Parse(headerValue)
		if err != nil {
			l.Info("Failed to parse X-Request-Id header", zap.Error(err))
		}
	}

	if value == uuid.Nil {
		value = uuid.New()
	}

	l = l.With("rid", value)
	ctx := loggers.WithCtx(r.Context(), l.Desugar())
	ctx = context.WithValue(ctx, ctxKey{}, value)
	return r.WithContext(ctx)
}

func HasHeader(r *http.Request) bool {
	return r.Header.Get("X-Request-Id") != ""
}
