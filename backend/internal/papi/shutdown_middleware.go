package papi

import (
	"context"
	"net/http"
)

type onShutdownContextKey struct{}

func WrapHandlerWithOnShutdownMiddleware(srv *http.Server) {
	onShutdown := make(chan struct{})

	srv.RegisterOnShutdown(func() {
		close(onShutdown)
	})

	handler := srv.Handler
	srv.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := context.WithValue(r.Context(), onShutdownContextKey{}, onShutdown)
		handler.ServeHTTP(w, r.WithContext(ctx))
	})
}

func ServerOnShutdown(ctx context.Context) chan struct{} {
	return ctx.Value(onShutdownContextKey{}).(chan struct{})
}
