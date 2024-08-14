package main

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/admin"
	"github.com/dzfranklin/plantopo/backend/internal/papi"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/dzfranklin/plantopo/backend/internal/pwebhooks"
	"github.com/google/uuid"
	"io"
	"log"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"
)

// TODO: Integrate prometheus

func NewServer(env *pconfig.Env, repo *prepo.Repo) *http.Server {
	apiSrv, err := papi.New(env, repo)
	if err != nil {
		log.Fatal(err)
	}

	webhookSrv := pwebhooks.Routes(env)
	adminSrv := admin.Routes(env, repo)

	mux := http.NewServeMux()
	mux.HandleFunc("/status", handleStatus(env))
	mux.Handle("/docs/", http.StripPrefix("/docs", docsRoutes()))
	mux.Handle("/api/v1/", http.StripPrefix("/api/v1", apiSrv))
	mux.Handle("/webhooks/", webhookSrv)
	mux.Handle("/admin/", adminSrv)
	mux.HandleFunc("/httpbin/", handleHTTPBin)

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

func handleHTTPBin(w http.ResponseWriter, r *http.Request) {
	longpollParam := r.URL.Query().Get("longpoll")
	if longpollParam != "" {
		longpoll, err := strconv.ParseInt(longpollParam, 10, 64)
		if err != nil {
			http.Error(w, "Bad longpoll param", http.StatusBadRequest)
			return
		}
		time.Sleep(time.Duration(longpoll) * time.Minute)
	}

	w.Header().Set("Content-Type", "text/plain")

	err := r.ParseForm()
	if err != nil {
		http.Error(w, "Invalid form data", http.StatusBadRequest)
		return
	}

	fmt.Fprintf(w, "Method: %s\n", r.Method)

	encodedURL, err := json.MarshalIndent(r.URL, "    ", "    ")
	if err != nil {
		panic(err)
	}
	fmt.Fprintf(w, "RequestURI: %s\n", r.RequestURI)
	fmt.Fprintf(w, "URL:\n%s\n", encodedURL)

	fmt.Fprintf(w, "Proto: %s\n", r.Proto)

	fmt.Fprintln(w, "Header:")
	for k, v := range r.Header {
		fmt.Fprintf(w, "    %s: %s\n", k, v)
	}

	fmt.Fprintf(w, "ContentLength: %d\n", r.ContentLength)
	fmt.Fprintf(w, "TransferEncoding: %s\n", strings.Join(r.TransferEncoding, ", "))
	fmt.Fprintf(w, "Host: %s\n", r.Host)

	fmt.Fprintln(w, "Form:")
	for k, v := range r.Form {
		fmt.Fprintf(w, "    %s: %s\n", k, v)
	}

	fmt.Fprintf(w, "RemoteAddr: %s\n", r.RemoteAddr)

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Error reading body", http.StatusBadRequest)
		return
	}
	fmt.Fprintln(w, "Body:")
	fmt.Println(body)
}
