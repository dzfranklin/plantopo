package papi

import (
	"context"
	"fmt"
	"github.com/ogen-go/ogen/middleware"
	"net/netip"
	"strings"
)

type ClientInfo struct {
	UserAgent string
	IP        netip.Addr
}

type clientInfoContextKey struct{}

func setClientInfoMiddleware(req middleware.Request, next middleware.Next) (middleware.Response, error) {
	ipValue := req.Raw.RemoteAddr
	fwdIPValue := req.Raw.Header.Get("X-Forwarded-For")
	if fwdIPValue != "" {
		ipValue = fwdIPValue
		ips := strings.Split(fwdIPValue, ", ")
		if len(ips) > 1 {
			ipValue = ips[0]
		}
	}
	addrPort, err := netip.ParseAddrPort(ipValue)
	if err != nil {
		fmt.Println("--- TODO: RemoteAddr is", req.Raw.RemoteAddr, "and fwdIPValue is", fwdIPValue)
		return middleware.Response{}, fmt.Errorf("setClientInfoMiddleware: %w: %s", err, ipValue)
	}

	userAgent := req.Raw.Header.Get("User-Agent")

	clientInfo := &ClientInfo{
		UserAgent: userAgent,
		IP:        addrPort.Addr(),
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
