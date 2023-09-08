package main

import (
	"context"
	"encoding/base64"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"time"

	"github.com/danielzfranklin/plantopo/logger"
	"github.com/danielzfranklin/plantopo/mapsync"
	"github.com/danielzfranklin/plantopo/server/routes"
	"github.com/gorilla/securecookie"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

func main() {
	l := logger.Get()
	defer l.Sync()
	ctx := logger.WithCtx(context.Background(), l)

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
		l.Fatal("HOST and PORT must be set")
	}
	l = l.With(zap.String("host", host), zap.String("port", port))

	var wg sync.WaitGroup

	// must be single-node for matchmaker
	redis := redis.NewClient(&redis.Options{
		Addr: os.Getenv("REDIS_ADDR"),
	})

	l.Info("Starting matchmaker")
	matchmakerCtx, cancelMatchmaker := context.WithCancel(ctx)
	matchmaker := mapsync.NewMatchmaker(matchmakerCtx, mapsync.Config{
		Host: host,
		Rdb:  redis,
		Wg:   &wg,
	})

	router := routes.New(&routes.Services{
		Matchmaker: &matchmaker,
		Redis:      redis,
	})
	server := &http.Server{
		Addr:    fmt.Sprintf("%s:%s", host, port),
		Handler: router,
	}

	go func() {
		l.Info("starting http server")
		err := server.ListenAndServe()
		if err == http.ErrServerClosed {
			l.Info("http server closed")
		} else {
			l.Fatal("http server error", zap.Error(err))
		}
	}()

	ctrlc := make(chan os.Signal, 1)
	signal.Notify(ctrlc, os.Interrupt)
	<-ctrlc

	cancelCtx, cancelCancel := context.WithTimeout(ctx, time.Second*15)
	defer cancelCancel()
	if err := server.Shutdown(cancelCtx); err != nil {
		l.Fatal("server shutdown error", zap.Error(err))
	}
	cancelMatchmaker()

	wg.Wait()
	l.Info("server shutdown complete")
}
