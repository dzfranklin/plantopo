package main

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/penv"
	"github.com/dzfranklin/plantopo/backend/internal/pgeophotos"
	"github.com/dzfranklin/plantopo/backend/internal/plog"
	_ "go.uber.org/automaxprocs"
	"net/http"
	"os"
	"os/signal"
	"runtime/pprof"
	"sync/atomic"
	"syscall"
	"time"
)

/** Lifecycle:

- Spawn tasks
- Wait for a quit request
- Quit. If at any point quitBlockers becomes empty skip to the end
	- Cancel ctx
	- Wait for softQuitTimeout then cancel softQuitCtx
	- Wait for hardQuitTimeout then cancel hardQuitCtx
	- Wait for a fraction of a second then exit the program.
	  (This probably gives tasks a chance to log right after their hard quit times out)
*/

var env = penv.Load()
var l = env.Logger

// Constraint: Kubernetes defaults to hard-killing pods after 30sec
var softQuitTimeout = 10 * time.Second
var hardQuitTimeout = 2 * time.Second

var startQuit = make(chan struct{})                                           // If sent to the server will enter quitting state if not already quitting
var hardQuitCtx, cancelHardQuitCtx = context.WithCancel(context.Background()) // Cancelled when tasks should give up on hard quitting
var softQuitCtx, cancelSoftQuitCtx = context.WithCancel(hardQuitCtx)          // Cancelled when tasks should give up on soft quitting
var ctx, cancel = context.WithCancel(softQuitCtx)                             // Cancelled when tasks should start quitting
var quitBlockers LabelledWaitGroup
var dumpOnQuit atomic.Bool

func main() {
	startSignalHandlers()

	startJobWorkers()
	startServer()
	startAdminServer()
	startMetaServer()

	if env.IsProduction {
		startGeophotosIndexer()
	}

	<-startQuit
	triggerQuitAndExit()
}

func startJobWorkers() {
	quitBlockers.Do("job_workers", func() {
		l.Info("running job workers")
		startErr := env.Jobs.Start(context.Background())
		if startErr != nil {
			l.Error("failed to start job workers", plog.Error(startErr))
			return
		}

		<-ctx.Done()

		l.Info("stopping job workers")
		stopStart := time.Now()

		// First stop fetching new jobs and try waiting for in-progress jobs to finish
		softStopErr := env.Jobs.Stop(softQuitCtx)
		if softStopErr != nil {
			l.Error("failed to soft stop job workers", plog.Error(softStopErr))

			// Next try cancelling the context of in-progress jobs and waiting for them to finish
			hardStopErr := env.Jobs.StopAndCancel(hardQuitCtx)
			if hardStopErr != nil {
				// Finally if jobs are still running give up and stop delaying the quit
				l.Error("failed to hard stop job workers", plog.Error(hardStopErr))
				return
			}

			l.Warn("hard stopped job workers", "time", time.Since(stopStart))
			return
		}

		l.Info("soft stopped job workers", "time", time.Since(stopStart))
	})
}

func startServer() {
	quitBlockers.Do("server", func() {
		srv := NewServer(env)

		go func() {
			<-ctx.Done()

			l.Info("shutting down server")

			// First stop listening and try waiting for active connections to go idle
			softStopErr := srv.Shutdown(softQuitCtx)
			if softStopErr != nil {
				l.Error("soft server shutdown failed", plog.Error(softStopErr))

				hardStopErr := srv.Close()
				if hardStopErr != nil {
					l.Error("hard server shutdown failed", plog.Error(hardStopErr))
					return
				}

				l.Warn("hard stopped server")
			}
		}()

		l.Info("running server", "addr", srv.Addr, "domain", env.Config.Server.Domain)
		srvErr := srv.ListenAndServe()
		if ctx.Err() == nil {
			l.Error("server stopped unexpectedly, requesting quit", plog.Error(srvErr))
			startQuit <- struct{}{}
		} else if srvErr != nil && !errors.Is(srvErr, http.ErrServerClosed) {
			l.Error("server error (intending to stop)", plog.Error(srvErr))
		} else {
			l.Info("server stopped")
		}
	})
}

func startAdminServer() {
	quitBlockers.Do("admin_server", func() {
		srv := NewAdminServer(env)

		go func() {
			<-ctx.Done()
			if closeErr := srv.Close(); closeErr != nil {
				l.Error("admin server close failed", plog.Error(closeErr))
			}
		}()

		l.Info("running admin server", "addr", srv.Addr)
		srvErr := srv.ListenAndServe()
		if ctx.Err() == nil {
			l.Error("admin server stopped unexpectedly", plog.Error(srvErr))
		} else if srvErr != nil && !errors.Is(srvErr, http.ErrServerClosed) {
			l.Error("admin server error (intending to stop)", plog.Error(srvErr))
		} else {
			l.Info("admin server stopped")
		}
	})
}

func startMetaServer() {
	quitBlockers.Do("meta_server", func() {
		srv := NewMetaServer(env)

		go func() {
			<-ctx.Done()
			if closeErr := srv.Close(); closeErr != nil {
				l.Error("meta server close failed", plog.Error(closeErr))
			}
		}()

		l.Info("running meta server", "addr", srv.Addr)
		srvErr := srv.ListenAndServe()
		if ctx.Err() == nil {
			l.Error("meta server stopped unexpectedly", plog.Error(srvErr))
		} else if srvErr != nil && !errors.Is(srvErr, http.ErrServerClosed) {
			l.Error("meta server error (intending to stop)", plog.Error(srvErr))
		} else {
			l.Info("meta server stopped")
		}
	})
}

func startGeophotosIndexer() {
	quitBlockers.Do("geophotos_indexer", func() {
		svc := pgeophotos.New(env)
		runErr := svc.RunIndexer(ctx)
		if ctx.Err() != nil {
			l.Error("geophotos indexer stopped unexpectedly", plog.Error(runErr))
		} else {
			l.Info("geophotos indexer stopped")
		}
	})
}

func startSignalHandlers() {
	go func() {
		sigusr1 := make(chan os.Signal, 1)
		signal.Notify(sigusr1, syscall.SIGUSR1)
		for {
			select {
			case <-sigusr1:
				outputConcurrencyDebugProfiles("SIGUSR1")
			case <-hardQuitCtx.Done():
				return
			}
		}
	}()

	go func() {
		osQuitSignals := make(chan os.Signal, 10) // buffer larger than the max number we are interested in
		signal.Notify(osQuitSignals, os.Interrupt, syscall.SIGTERM, syscall.SIGQUIT)
		for count := 0; count <= 2; count++ {
			sig := <-osQuitSignals

			if sig == syscall.SIGQUIT {
				dumpOnQuit.Store(true)
			}

			switch count {
			case 0:
				l.Info(fmt.Sprintf("received %s, soft quitting...", sig))
				startQuit <- struct{}{}
			case 1:
				l.Info(fmt.Sprintf("received %s (second signal), aborting soft quit and hard quitting...", sig))
				cancelSoftQuitCtx()
			case 2:
				l.Info(fmt.Sprintf("received %s (third signal), aborting hard quit and exiting...", sig))
				cancelHardQuitCtx()
			}
		}
	}()
}

func triggerQuitAndExit() {
	didSoftQuit := false
	completedQuit := func() bool {
		quitStart := time.Now()
		softTimer := time.NewTimer(softQuitTimeout)
		hardTimer := time.NewTimer(softQuitTimeout + hardQuitTimeout)

		quitUnblocked := make(chan struct{})
		go func() {
			quitBlockers.Wait()
			close(quitUnblocked)
		}()

		// Start soft quitting
		cancel()

		// Drain the channel during the quit process so sends don't block long
		stopDrainingStartQuit := make(chan struct{})
		go func() {
			for {
				select {
				case <-startQuit:
				case <-stopDrainingStartQuit:
					return
				}
			}
		}()
		defer close(stopDrainingStartQuit)

		select {
		case now := <-softTimer.C:
			l.Warn("soft quit timed out", "blockers", quitBlockers.Active(), "timeout", softQuitTimeout,
				"totalElapsed", now.Sub(quitStart))
			outputConcurrencyDebugProfiles("softQuitFail")
		case <-quitUnblocked:
			l.Info("soft quit", "timeout", softQuitTimeout, "totalElapsed", time.Since(quitStart))
			didSoftQuit = true
			cancelHardQuitCtx()
			return true
		}

		// Stop soft quitting and start hard quitting
		cancelSoftQuitCtx()

		select {
		case now := <-hardTimer.C:
			l.Error("hard quit timed out", "blockers", quitBlockers.Active(), "timeout", hardQuitTimeout,
				"totalElapsed", now.Sub(quitStart))
			outputConcurrencyDebugProfiles("hardQuitFail")
		case <-quitUnblocked:
			l.Info("hard quit", "timeout", hardQuitTimeout, "totalElapsed", time.Since(quitStart))
			return true
		}

		// Stop hard quitting
		cancelHardQuitCtx()

		return false
	}()

	if completedQuit {
		// Try to close the database so we can warn if there are still open connections
		//
		// Note that if a river job doesn't respond to its context being cancelled we
		// still want river to be able to update the database before exiting. This means
		// we prefer the database be available during the hard quit so we can't start
		// closing earlier.
		closeDBStart := time.Now()
		didCloseDB := make(chan struct{})
		go func() {
			env.DB.Close()
			close(didCloseDB)
		}()
		select {
		case <-didCloseDB:
			l.Info("closed database", "time", time.Since(closeDBStart))
		case <-time.After(100 * time.Millisecond):
			l.Warn("failed to close database: check for open connections",
				"stats", env.DBStats(), "waited", time.Since(closeDBStart))
			outputConcurrencyDebugProfiles("dbCloseFail")
		}

		if !didSoftQuit || dumpOnQuit.Load() {
			outputConcurrencyDebugProfiles("quit")
		}

		os.Exit(0)
	} else {
		// Briefly wait to probably give tasks the chance to log in response to the hard quit failing
		time.Sleep(100 * time.Millisecond)

		if dumpOnQuit.Load() {
			outputConcurrencyDebugProfiles("quit")
		}

		l.Error("Force quitting")

		os.Exit(1)
	}
}

func outputConcurrencyDebugProfiles(label string) {
	if label == "" {
		label = "dbg"
	}

	prefix := fmt.Sprintf("[%s] ", label)

	var pprofBuf bytes.Buffer

	if err := pprof.Lookup("goroutine").WriteTo(&pprofBuf, 2); err != nil {
		_, _ = pprofBuf.WriteString("outputConcurrencyDebugProfiles goroutine: " + err.Error())
	}

	for _, name := range []string{"threadcreate", "block", "mutex"} {
		if err := pprof.Lookup(name).WriteTo(&pprofBuf, 1); err != nil {
			_, _ = pprofBuf.WriteString("outputConcurrencyDebugProfiles " + name + ": " + err.Error())
		}
	}

	b := bytes.NewBuffer(make([]byte, 0, pprofBuf.Len()*2))
	fmt.Fprintf(b, "%s%s\n", prefix, time.Now())
	for r := bufio.NewReader(&pprofBuf); ; {
		pprofLine, readErr := r.ReadBytes('\n')
		if readErr != nil {
			break
		}
		b.WriteString(prefix)
		b.Write(pprofLine)
	}
	b.WriteString("\n\n")

	_, _ = b.WriteTo(os.Stderr)
}
