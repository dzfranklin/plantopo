package papi

import (
	"context"
	"github.com/ogen-go/ogen/middleware"
)

type ClientInfo struct {
	UserAgent string
}

type clientInfoContextKey struct{}

func setClientInfoMiddleware(req middleware.Request, next middleware.Next) (middleware.Response, error) {
	userAgent := req.Raw.Header.Get("User-Agent")

	clientInfo := &ClientInfo{
		UserAgent: userAgent,
	}
	req.Context = context.WithValue(req.Context, clientInfoContextKey{}, clientInfo)

	return next(req)
}

func getClientInfo(ctx context.Context) *ClientInfo {
	val, ok := ctx.Value(clientInfoContextKey{}).(*ClientInfo)
	if !ok {
		panic("context missing ClientInfo")
	}
	return val
}
