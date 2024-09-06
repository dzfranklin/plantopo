package main

import (
	"context"
	"errors"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/penv"
	"github.com/dzfranklin/plantopo/backend/internal/pgeophotos"
	"github.com/dzfranklin/plantopo/backend/internal/ptime"
	"log"
	"math/rand"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"
)

func main() {
	env := penv.Load()
	l := env.Logger

	shouldQuit := make(chan struct{})
	var quitGroup sync.WaitGroup

	l.Info("river starting")
	err := env.Jobs.Start(context.Background())
	if err != nil {
		log.Fatal(err)
	}
	quitGroup.Add(1)
	go func() {
		defer quitGroup.Done()
		<-shouldQuit

		softStopCtx, softStopCtxCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer softStopCtxCancel()

		err := env.Jobs.Stop(softStopCtx)
		if err != nil && !errors.Is(err, context.DeadlineExceeded) && !errors.Is(err, context.Canceled) {
			log.Fatal(err)
		}
		if err == nil {
			l.Info("soft stopped river")
			return
		}

		hardStopCtx, hardStopCtxCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer hardStopCtxCancel()

		// As long as all jobs respect context cancellation, StopAndCancel will
		// always work. However, in the case of a bug where a job blocks despite
		// being cancelled, it may be necessary to either ignore River's stop
		// result (what's shown here) or have a supervisor kill the process.
		err = env.Jobs.StopAndCancel(hardStopCtx)
		if err != nil && errors.Is(err, context.DeadlineExceeded) {
			fmt.Printf("Hard stop timeout; ignoring stop procedure and exiting unsafely\n")
		} else if err != nil {
			log.Fatal(err)
		}

		// hard stop succeeded
	}()

	quitGroup.Add(2)
	go func() {
		defer quitGroup.Done()
		srv := NewServer(env)

		go func() {
			defer quitGroup.Done()
			<-shouldQuit

			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()

			l.Info("shutting down server")
			err := srv.Shutdown(ctx)
			if err != nil {
				l.Error("server shutdown failed", "error", err)
			}
			l.Info("shut down server")
		}()

		l.Info("server starting", "addr", srv.Addr)
		err := srv.ListenAndServe()
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			l.Error("server failed", "error", err)
		}
	}()

	quitGroup.Add(2)
	go func() {
		defer quitGroup.Done()
		srv := NewMetaServer(env)

		go func() {
			defer quitGroup.Done()
			<-shouldQuit

			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()

			l.Info("shutting down meta server")
			err := srv.Shutdown(ctx)
			if err != nil {
				l.Error("meta server shutdown failed", "error", err)
			}
			l.Info("shut down meta server")
		}()

		l.Info("meta server starting", "addr", srv.Addr)
		err := srv.ListenAndServe()
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			l.Error("meta server failed", "error", err)
		}
	}()

	// Geophotos indexer
	if env.IsProduction {
		quitGroup.Add(2)
		go func() {
			defer quitGroup.Done()
			srv := pgeophotos.New(env)
			indexCtx, cancel := context.WithCancel(context.Background())
			go func() {
				defer quitGroup.Done()

				if err := ptime.Sleep(indexCtx, time.Duration(rand.Intn(60))*time.Second); err != nil && !errors.Is(err, context.Canceled) {
					l.Error("sleep failed", "error", err)
				}

				for {
					l.Info("running geophotos indexer")
					runErr := srv.RunIndexer(indexCtx)
					if errors.Is(runErr, context.Canceled) {
						break
					} else if runErr != nil {
						l.Error("geophotos indexer failed", "error", runErr)
						sleepErr := ptime.Sleep(indexCtx, time.Hour)
						if errors.Is(sleepErr, context.Canceled) {
							break
						}
						continue
					}
				}
			}()
			<-shouldQuit
			cancel()
		}()
	}

	quitRequestSignal := make(chan os.Signal, 1)
	signal.Notify(quitRequestSignal, syscall.SIGINT, syscall.SIGTERM)

	quitSignalReceived := <-quitRequestSignal
	l.Info("shutting down", "signal", quitSignalReceived.String())

	go func() {
		<-quitRequestSignal
		l.Info("force shutting down")
		os.Exit(1)
	}()

	close(shouldQuit)
	quitGroup.Wait()
}
