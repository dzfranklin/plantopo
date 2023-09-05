package main

import (
	"context"
	"flag"
	"os"
	"os/signal"
	"sync"

	"github.com/danielzfranklin/plantopo/server/logger"
	"github.com/danielzfranklin/plantopo/server/mapsync"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

func main() {
	ctx, cancel := context.WithCancel(context.Background())

	l := logger.Get()
	defer l.Sync()
	ctx = logger.WithCtx(ctx, l)

	addr := flag.String("addr", "", "address of this server")
	flag.Parse()
	if *addr == "" {
		l.Fatal("addr must be set")
	}

	var wg sync.WaitGroup

	// must be single-node for matchmaker
	redis := redis.NewClient(&redis.Options{
		Addr: os.Getenv("REDIS_ADDR"),
	})

	ctrlc := make(chan os.Signal, 1)
	signal.Notify(ctrlc, os.Interrupt)
	defer func() {
		signal.Stop(ctrlc)
		cancel()
	}()
	go func() {
		select {
		case <-ctrlc:
			l.Info("received ctrl-c")
			cancel()
		case <-ctx.Done():
		}
	}()

	l.Info("starting server", zap.String("addr", *addr))
	defer l.Info("server shutdown complete")

	_ = mapsync.NewMatchmaker(ctx, mapsync.Config{
		Addr: *addr,
		Rdb:  redis,
		Wg:   &wg,
	})

	wg.Wait()
}
