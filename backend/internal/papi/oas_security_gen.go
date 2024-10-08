// Code generated by ogen, DO NOT EDIT.

package papi

import (
	"context"
	"net/http"
	"strings"

	"github.com/go-faster/errors"

	"github.com/ogen-go/ogen/ogenerrors"
)

// SecurityHandler is handler for security parameters.
type SecurityHandler interface {
	// HandleBearer handles bearer security.
	HandleBearer(ctx context.Context, operationName string, t Bearer) (context.Context, error)
	// HandleBrowser handles browser security.
	HandleBrowser(ctx context.Context, operationName string, t Browser) (context.Context, error)
}

func findAuthorization(h http.Header, prefix string) (string, bool) {
	v, ok := h["Authorization"]
	if !ok {
		return "", false
	}
	for _, vv := range v {
		scheme, value, ok := strings.Cut(vv, " ")
		if !ok || !strings.EqualFold(scheme, prefix) {
			continue
		}
		return value, true
	}
	return "", false
}

func (s *Server) securityBearer(ctx context.Context, operationName string, req *http.Request) (context.Context, bool, error) {
	var t Bearer
	token, ok := findAuthorization(req.Header, "Bearer")
	if !ok {
		return ctx, false, nil
	}
	t.Token = token
	rctx, err := s.sec.HandleBearer(ctx, operationName, t)
	if errors.Is(err, ogenerrors.ErrSkipServerSecurity) {
		return nil, false, nil
	} else if err != nil {
		return nil, false, err
	}
	return rctx, true, err
}
func (s *Server) securityBrowser(ctx context.Context, operationName string, req *http.Request) (context.Context, bool, error) {
	var t Browser
	const parameterName = "session"
	var value string
	switch cookie, err := req.Cookie(parameterName); {
	case err == nil: // if NO error
		value = cookie.Value
	case errors.Is(err, http.ErrNoCookie):
		return ctx, false, nil
	default:
		return nil, false, errors.Wrap(err, "get cookie value")
	}
	t.APIKey = value
	rctx, err := s.sec.HandleBrowser(ctx, operationName, t)
	if errors.Is(err, ogenerrors.ErrSkipServerSecurity) {
		return nil, false, nil
	} else if err != nil {
		return nil, false, err
	}
	return rctx, true, err
}

// SecuritySource is provider of security values (tokens, passwords, etc.).
type SecuritySource interface {
	// Bearer provides bearer security value.
	Bearer(ctx context.Context, operationName string) (Bearer, error)
	// Browser provides browser security value.
	Browser(ctx context.Context, operationName string) (Browser, error)
}

func (s *Client) securityBearer(ctx context.Context, operationName string, req *http.Request) error {
	t, err := s.sec.Bearer(ctx, operationName)
	if err != nil {
		return errors.Wrap(err, "security source \"Bearer\"")
	}
	req.Header.Set("Authorization", "Bearer "+t.Token)
	return nil
}
func (s *Client) securityBrowser(ctx context.Context, operationName string, req *http.Request) error {
	t, err := s.sec.Browser(ctx, operationName)
	if err != nil {
		return errors.Wrap(err, "security source \"Browser\"")
	}
	req.AddCookie(&http.Cookie{
		Name:  "session",
		Value: t.APIKey,
	})
	return nil
}
