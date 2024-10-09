package main

import (
	"github.com/davidbyttow/govips/v2/vips"
	"github.com/lmittmann/tint"
	"log/slog"
	"net/http"
	"os"
)

func main() {
	l := createLoggerForEnv(os.Getenv("APP_ENV"))

	vips.LoggingSettings(func(domain string, level vips.LogLevel, msg string) {
		switch level {
		case vips.LogLevelError:
			l.Error("vips: " + msg)
		case vips.LogLevelWarning:
			l.Warn("vips: " + msg)
		case vips.LogLevelInfo:
			l.Info("vips: " + msg)
		}
	}, vips.LogLevelWarning)

	vips.Startup(nil)

	svc := &Service{
		tiles: newTileCache(l, requestFromOSM),
	}

	http.HandleFunc("GET /status", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("OK"))
	})

	http.HandleFunc("GET /{$}", func(w http.ResponseWriter, r *http.Request) {
		l.Info("got request", "query", r.URL.RawQuery)

		opts, parseOptsErr := ParseOpts(r.URL.RawQuery)
		if parseOptsErr != nil {
			http.Error(w, "invalid query: "+parseOptsErr.Error(), http.StatusBadRequest)
			return
		}

		webp, drawErr := svc.DrawWebp(r.Context(), opts)
		if drawErr != nil {
			http.Error(w, "failed to draw: "+drawErr.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "image/webp")
		w.Header().Set("Cache-Control", "max-age=31536000") // one year, the max

		_, _ = w.Write(webp)
	})

	l.Info("starting server")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		panic(err)
	}
}

func createLoggerForEnv(env string) *slog.Logger {
	var h slog.Handler
	h = slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		AddSource: true,
		Level:     slog.LevelInfo,
	})
	if env == "development" {
		h = tint.NewHandler(os.Stdout, &tint.Options{
			Level: slog.LevelDebug,
		})
	}
	return slog.New(h)
}
