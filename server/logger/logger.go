package logger

import (
	"context"
	"os"
	"sync"

	"go.uber.org/zap"
)

var logger *zap.Logger

func Get() *zap.Logger {
	sync.OnceFunc(func() {
		if os.Getenv("APP_ENV") == "development" {
			newLogger, err := zap.NewDevelopment(zap.AddCaller(), zap.AddStacktrace(zap.ErrorLevel))
			if err != nil {
				panic(err)
			}
			logger = newLogger
		} else {
			newLogger, err := zap.NewProduction(zap.AddStacktrace(zap.ErrorLevel))
			if err != nil {
				panic(err)
			}
			logger = newLogger
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

	return zap.NewNop()
}

func WithCtx(ctx context.Context, l *zap.Logger) context.Context {
	if lp, ok := ctx.Value(ctxKey{}).(*zap.Logger); ok {
		if lp == l {
			return ctx
		}
	}

	return context.WithValue(ctx, ctxKey{}, l)
}
