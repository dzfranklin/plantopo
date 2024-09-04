package main

import (
	"context"
	"errors"
	"github.com/dzfranklin/plantopo/backend/internal/penv"
	"github.com/dzfranklin/plantopo/backend/internal/pflickr"
	"os"
	"os/signal"
	"sync"
	"syscall"
)

func main() {
	env := penv.Load()
	l := env.Logger

	ctx, cancel := context.WithCancel(context.Background())
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		svc := pflickr.NewService(env)
		if err := svc.IndexFlickr(ctx); err != nil && !errors.Is(err, context.Canceled) {
			l.Error(err.Error())
			os.Exit(1)
		}
	}()

	quitRequestSig := make(chan os.Signal, 1)
	signal.Notify(quitRequestSig, syscall.SIGINT, syscall.SIGTERM)
	quitSignalReceived := <-quitRequestSig
	l.Info("shutting down", "signal", quitSignalReceived.String())
	cancel()
	wg.Wait()
}
