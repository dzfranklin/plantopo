package papi

import (
	"context"
	"errors"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
)

type psecurity struct {
	*pconfig.Env
	*prepo.Repo
}

type sessionTokenContextKey struct{}
type authenticatedUserContextKey struct{}

func (s *psecurity) HandleBearer(ctx context.Context, _ string, t Bearer) (context.Context, error) {
	return s.handle(ctx, t.Token)
}

func (s *psecurity) HandleBrowser(ctx context.Context, _ string, t Browser) (context.Context, error) {
	return s.handle(ctx, t.APIKey)
}

func (s *psecurity) handle(ctx context.Context, token string) (context.Context, error) {
	user, err := s.Sessions.LookupUser(token)
	if err != nil {
		if errors.Is(err, prepo.ErrInvalidSessionToken) {
			return ctx, nil
		}
		return ctx, err
	}

	ctx = context.WithValue(ctx, authenticatedUserContextKey{}, user)
	ctx = context.WithValue(ctx, sessionTokenContextKey{}, token)
	return ctx, err
}

func getAuthenticatedUser(ctx context.Context) (string, bool) {
	user, ok := ctx.Value(authenticatedUserContextKey{}).(string)
	return user, ok
}

func getSessionToken(ctx context.Context) (string, bool) {
	token, ok := ctx.Value(sessionTokenContextKey{}).(string)
	return token, ok
}
