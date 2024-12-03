package main

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/admin"
	"github.com/dzfranklin/plantopo/backend/internal/papi"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/pwebhooks"
	"github.com/google/uuid"
	"log"
	"net/http"
	"slices"
	"sync"
	"time"
)

// TODO: Integrate prometheus

func NewServer(env *pconfig.Env) *http.Server {
	apiSrv, err := papi.New(env)
	if err != nil {
		log.Fatal(err)
	}

	webhookSrv := pwebhooks.Routes(env)
	adminSrv := admin.Routes(env)

	mux := http.NewServeMux()
	mux.HandleFunc("/status", handleStatus(env))
	mux.Handle("/docs/", http.StripPrefix("/docs", docsRoutes()))
	mux.Handle("/api/v1/", http.StripPrefix("/api/v1", apiSrv))
	mux.Handle("/webhooks/", webhookSrv)
	mux.Handle("/admin/", adminSrv)

	srv := &http.Server{
		Handler: instrumentRequests(recoverPanic(env, papi.AssignRequestID(enableCORS(env, mux)))),
		Addr:    fmt.Sprintf("0.0.0.0:%d", env.Config.Server.Port),
	}

	return srv
}

type statusResult struct {
	name string
	err  error
	time time.Duration
}

func handleStatus(env *pconfig.Env) http.HandlerFunc {
	checks := []struct {
		name string
		fn   func(ctx context.Context) error
	}{
		{"postgres", func(ctx context.Context) error {
			return env.DB.Ping(ctx)
		}},
		{"redis", func(ctx context.Context) error {
			return env.RDB.Ping(ctx).Err()
		}},
		{"s3", func(ctx context.Context) error {
			if !env.Objects.IsOnline() {
				return errors.New("is offline")
			}
			return nil
		}},
		{"metrics", func(ctx context.Context) error {
			resp, err := http.Get(fmt.Sprintf("http://localhost:%d/metrics", env.Config.Server.MetaPort))
			if err != nil {
				return err
			}
			if resp.StatusCode != http.StatusOK {
				return errors.New("status not OK")
			}
			return nil
		}},
	}
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 1*time.Second)
		defer cancel()

		var results []statusResult
		var mu sync.Mutex
		var wg sync.WaitGroup
		for _, check := range checks {
			wg.Add(1)
			go func() {
				defer wg.Done()

				start := time.Now()
				err := check.fn(ctx)
				elapsed := time.Since(start)

				mu.Lock()
				defer mu.Unlock()

				result := statusResult{name: check.name, err: err, time: elapsed}
				results = append(results, result)
			}()
		}
		wg.Wait()

		slices.SortFunc(results, func(a, b statusResult) int {
			return cmp.Compare(a.name, b.name)
		})

		hasFailure := false
		for _, result := range results {
			if result.err != nil {
				hasFailure = true
			}
		}

		if hasFailure {
			correlationID := "statcor_" + uuid.New().String()
			_, _ = fmt.Println("FAILURE")
			_, _ = fmt.Fprintf(w, "correlationID: %s", correlationID)
			for _, result := range results {
				if result.err != nil {
					env.Logger.Error("error in status",
						"name", result.name,
						"error", result.err,
						"elapsed_secs", result.time.Seconds(),
						"correlationID", correlationID)
				}
			}
		} else {
			_, _ = fmt.Fprintf(w, "ALL OK\n")
		}

		for _, result := range results {
			if result.err == nil {
				_, _ = fmt.Fprintf(w, "%s OK (took %dms)\n", result.name, result.time.Milliseconds())
			} else {
				_, _ = fmt.Fprintf(w, "%s FAILED (took %dms)\n", result.name, result.time.Milliseconds())
			}
		}
	}
}
