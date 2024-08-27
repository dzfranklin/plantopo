package papi

import (
	"context"
	"github.com/ogen-go/ogen/middleware"
	"net/netip"
)

type ClientInfo struct {
	UserAgent string
	IPAddr    netip.Addr
}

type clientInfoContextKey struct{}

func (h *phandler) setClientInfoMiddleware(req middleware.Request, next middleware.Next) (middleware.Response, error) {
	userAgent := req.Raw.Header.Get("User-Agent")

	ipAddr, err := netip.ParseAddr(req.Raw.Header.Get("X-Real-IP"))
	if err != nil {
		if h.IsProduction {
			panic("invalid ip header")
		} else {
			ipAddr = netip.IPv4Unspecified()
		}
	}

	clientInfo := &ClientInfo{
		UserAgent: userAgent,
		IPAddr:    ipAddr,
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
