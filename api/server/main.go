package main

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/danielzfranklin/plantopo/api/db"
	"github.com/danielzfranklin/plantopo/api/logger"
	"github.com/danielzfranklin/plantopo/api/mailer"
	"github.com/danielzfranklin/plantopo/api/map_sync"
	"github.com/danielzfranklin/plantopo/api/maps"
	"github.com/danielzfranklin/plantopo/api/server/routes"
	"github.com/danielzfranklin/plantopo/api/users"
	"github.com/google/uuid"
	"github.com/gorilla/securecookie"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

func main() {
	uuid.EnableRandPool()

	ul := logger.Get()
	defer ul.Sync()
	ctx := logger.WithCtx(context.Background(), ul)
	l := ul.Sugar()

	if os.Getenv("APP_ENV") == "development" {
		err := godotenv.Load(".env")
		if err != nil {
			log.Fatal("Error loading .env file")
		}
	}

	genSessionAuthKey := flag.Bool("gen-session-auth-key", false, "")
	flag.Parse()
	if *genSessionAuthKey {
		key := securecookie.GenerateRandomKey(64)
		fmt.Printf("%s\n", base64.StdEncoding.EncodeToString(key))
		return
	}

	host := os.Getenv("HOST")
	port := os.Getenv("PORT")
	if host == "" || port == "" {
		l.Fatalw("HOST and PORT must be set")
	}
	l = l.With(zap.String("host", host), zap.String("port", port))
	l.Infow("starting")

	var wg sync.WaitGroup

	// must be single-node for matchmaker
	redisUrl := os.Getenv("REDIS_URL")
	redisOpts, err := redis.ParseURL(redisUrl)
	if err != nil {
		l.Fatalw("error parsing redis url", zap.Error(err))
	}
	if strings.Contains(redisUrl, "rediss://") {
		redisOpts.TLSConfig = &tls.Config{
			MinVersion: tls.VersionTLS12,
		}
	}
	redis := redis.NewClient(redisOpts)
	_, err = redis.Ping(ctx).Result()
	l.Infow("checking redis")
	if err != nil {
		l.Fatalw("error connecting to redis", zap.Error(err))
	}

	mailerConfig := mailer.Config{}
	if os.Getenv("APP_ENV") == "development" {
		mailerConfig.Sender = &mailer.LogSender{Logger: l}
	} else {
		sesSender, err := mailer.NewSESSender()
		if err != nil {
			l.Fatalw("error creating SES sender", zap.Error(err))
		}
		mailerConfig.Sender = sesSender
	}
	mailer := mailer.New(ctx, mailerConfig)
	l.Infow("checking mailer")
	if !mailer.Healthz(ctx) {
		l.Fatalw("mailer health check failed")
	}

	pg, err := db.NewPg(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		l.Fatalw("error creating postgres pool", zap.Error(err))
	}
	l.Infow("checking postgres")
	if err := pg.Ping(ctx); err != nil {
		l.Fatalw("error pinging postgres", zap.Error(err))
	}

	users := users.NewService(ctx, pg, mailer)
	maps := maps.NewService(l.Desugar(), pg, users, mailer)

	matchmakerCtx, cancelMatchmaker := context.WithCancel(ctx)
	matchmaker := map_sync.NewMatchmaker(matchmakerCtx, map_sync.Config{
		Host: host,
		Rdb:  redis,
		Wg:   &wg,
		Repo: map_sync.NewRepo(l.Desugar(), pg),
	})
	l.Infow("checking matchmaker")
	if !matchmaker.Healthz(ctx) {
		l.Fatalw("matchmaker health check failed")
	}

	router := routes.New(&routes.Services{
		Matchmaker: &matchmaker,
		Redis:      redis,
		Pg:         pg,
		Users:      users,
		Maps:       maps,
		Mailer:     mailer,
	})
	server := &http.Server{
		Addr:    fmt.Sprintf(":%s", port),
		Handler: router,
	}

	go func() {
		l.Infow("starting http server")
		err := server.ListenAndServe()
		if err == http.ErrServerClosed {
			l.Infow("http server closed")
		} else {
			l.Fatalw("http server error", zap.Error(err))
		}
	}()

	ctrlc := make(chan os.Signal, 1)
	signal.Notify(ctrlc, os.Interrupt)
	<-ctrlc

	gracefulShutdownDone := make(chan struct{}, 1)
	go func() {
		cancelCtx, cancelCancel := context.WithTimeout(ctx, time.Second*15)
		defer cancelCancel()
		if err := server.Shutdown(cancelCtx); err != nil {
			l.Fatalw("server shutdown error", zap.Error(err))
		}

		cancelMatchmaker()

		wg.Wait()

		l.Infow("server shutdown complete")
		gracefulShutdownDone <- struct{}{}
	}()

	select {
	case <-gracefulShutdownDone:
		return
	case <-time.After(time.Second * 30):
		stackBuf := make([]byte, 1024*1024)
		length := runtime.Stack(stackBuf, true)
		stack := string(stackBuf[:length])

		l.Error("graceful server shutdown timed out", zap.String("stack", stack))
		fmt.Println(stack)
		l.Fatalw("graceful server shutdown timed out")
	}
}
