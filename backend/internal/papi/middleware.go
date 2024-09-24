package papi

import (
	"context"
	"github.com/ogen-go/ogen/middleware"
	"net/netip"
	"slices"
	"strings"
)

type ClientInfo struct {
	UserAgent string
	IPAddr    netip.Addr
}

type clientInfoContextKey struct{}
type contentEncodingContextKey struct{}

func (h *phandler) requestInfoMiddleware(req middleware.Request, next middleware.Next) (middleware.Response, error) {
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

	acceptEncoding := splitEncodingHeader(req.Raw.Header.Get("Accept-Encoding"))
	req.Context = context.WithValue(req.Context, contentEncodingContextKey{}, acceptEncoding)

	return next(req)
}

func getClientInfo(ctx context.Context) *ClientInfo {
	val, ok := ctx.Value(clientInfoContextKey{}).(*ClientInfo)
	if !ok {
		panic("context missing ClientInfo")
	}
	return val
}

func acceptsEncoding(ctx context.Context, encoding string) bool {
	values := ctx.Value(contentEncodingContextKey{}).([]string)
	return slices.Contains(values, encoding)
}

var noSpace = strings.NewReplacer(" ", "")

func splitEncodingHeader(raw string) []string {
	if raw == "" {
		return []string{}
	}
	return strings.Split(noSpace.Replace(raw), ",")
}
