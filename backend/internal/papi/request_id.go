package papi

import (
	"context"
	"github.com/oklog/ulid/v2"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"net/http"
)

var (
	requestsWithRequestIDCounter = promauto.NewCounter(prometheus.CounterOpts{
		Namespace: "plantopo",
		Name:      "requests_with_request_id",
	})

	requestsWithoutRequestIDCounter = promauto.NewCounter(prometheus.CounterOpts{
		Namespace: "plantopo",
		Name:      "requests_without_request_id",
	})
)

type requestIDContextKey struct{}

func AssignRequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var value string

		headerValue := r.Header.Get("X-Request-ID")
		if headerValue == "" {
			requestsWithoutRequestIDCounter.Inc()
			value = "gen_" + ulid.Make().String()
			w.Header().Add("X-Generated-Request-ID", value)
		} else {
			requestsWithRequestIDCounter.Inc()
			value = "cli_" + value
		}

		ctx := r.Context()
		ctx = context.WithValue(ctx, requestIDContextKey{}, value)
		r = r.WithContext(ctx)

		next.ServeHTTP(w, r)
	})
}

func GetRequestID(r *http.Request) string {
	value, ok := r.Context().Value(requestIDContextKey{}).(string)
	if !ok {
		panic("missing request ID")
	}
	return value
}
