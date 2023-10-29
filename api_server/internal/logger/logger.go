package logger

import (
	"context"
	"go.uber.org/zap/zapcore"
	"net/http"
	"os"
	"sync"
	"testing"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zaptest"
)

var logger *zap.Logger

func Get() *zap.Logger {
	sync.OnceFunc(func() {
		config := zap.NewProductionConfig()

		env := os.Getenv("APP_ENV")
		if env == "development" || env == "test" {
			config = zap.NewDevelopmentConfig()

			if os.Getenv("APP_QUIET") == "true" {
				config.Level = zap.NewAtomicLevelAt(zap.WarnLevel)
			}
		}

		config.EncoderConfig.EncodeTime = zapcore.TimeEncoderOfLayout(time.RFC3339)

		var err error
		logger, err = config.Build()
		if err != nil {
			panic(err)
		}
	})()
	return logger
}

type ctxKey struct{}

func FromCtx(ctx context.Context) *zap.Logger {
	if l, ok := ctx.Value(ctxKey{}).(*zap.Logger); ok {
		return l
	} else if l := logger; l != nil {
		return l
	}
	return Get()
}

func FromR(r *http.Request) *zap.Logger {
	return FromCtx(r.Context())
}

func WithCtx(ctx context.Context, l *zap.Logger) context.Context {
	if lp, ok := ctx.Value(ctxKey{}).(*zap.Logger); ok {
		if lp == l {
			return ctx
		}
	}

	return context.WithValue(ctx, ctxKey{}, l)
}

func NewTestLogger(t *testing.T) *zap.Logger {
	return zaptest.NewLogger(t, zaptest.WrapOptions(
		zap.Development(),
		zap.AddStacktrace(zap.ErrorLevel),
		zap.IncreaseLevel(zap.ErrorLevel),
	))
}
