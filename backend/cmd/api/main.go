package main

import (
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/joho/godotenv"
	"log"
	"log/slog"
	"os"
	"strconv"
	"strings"
)

func main() {
	_ = godotenv.Load(".env", ".env.local")

	cfg := &pconfig.Config{
		Port:           getEnvInt("PORT"),
		MetaPort:       getEnvInt("META_PORT"),
		Env:            getEnvString("APP_ENV"),
		CORSAllowHosts: getEnvStrings("CORS_ALLOW_HOSTS"),
	}
	cfg.Logger = pconfig.CreateLoggerForEnv(cfg.Env)

	metaSrv := NewMetaServer(cfg)
	srv := NewServer(cfg)

	go func() {
		if err := metaSrv.ListenAndServe(); err != nil {
			log.Fatal("meta server failed", err)
		}
	}()

	slog.Info(fmt.Sprintf("Listening on %s", srv.Addr))
	log.Fatal(srv.ListenAndServe())
}

func getEnvInt(key string) int {
	v := os.Getenv(key)
	if v == "" {
		panic(fmt.Sprintf("Missing environment variable %s", key))
	}
	parsed, err := strconv.ParseInt(v, 10, 32)
	if err != nil {
		panic(fmt.Sprintf("Invalid environment variable %s. Expected an integer, got %s", key, v))
	}
	return int(parsed)
}

func getEnvString(key string) string {
	v := os.Getenv(key)
	if v == "" {
		panic(fmt.Sprintf("Missing environment variable %s", key))
	}
	return v
}

func getEnvStrings(key string) []string {
	v := os.Getenv(key)
	if v == "" {
		panic(fmt.Sprintf("Missing environment variable %s", key))
	}
	var parsed []string
	for _, part := range strings.Split(v, ",") {
		parsed = append(parsed, strings.TrimSpace(part))
	}
	return parsed
}
