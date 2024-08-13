package plog

import (
	"context"
	"log/slog"
)

func Filtered(dst *slog.Logger, level slog.Level) *slog.Logger {
	return slog.New(filteredHandler{dst.Handler(), level})
}

type filteredHandler struct {
	handler  slog.Handler
	minLevel slog.Level
}

func (f filteredHandler) Enabled(_ context.Context, level slog.Level) bool {
	return level >= f.minLevel
}

func (f filteredHandler) Handle(ctx context.Context, record slog.Record) error {
	return f.handler.Handle(ctx, record)
}

func (f filteredHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return filteredHandler{f.handler.WithAttrs(attrs), f.minLevel}
}

func (f filteredHandler) WithGroup(name string) slog.Handler {
	return filteredHandler{f.handler.WithGroup(name), f.minLevel}
}
