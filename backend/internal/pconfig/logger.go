package pconfig

import (
	"github.com/lmittmann/tint"
	"log/slog"
	"os"
)

func CreateLoggerForEnv(env string) *slog.Logger {
	var h slog.Handler
	h = slog.NewJSONHandler(os.Stdout, nil)
	if env == "development" {
		h = tint.NewHandler(os.Stdout, &tint.Options{
			Level: slog.LevelDebug,
		})
	}
	return slog.New(h)
}
