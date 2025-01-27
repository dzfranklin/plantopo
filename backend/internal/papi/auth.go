package papi

import (
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"net/http"
)

const sessionCookieName = "session"

func (h *phandler) AuthCheckPost(ctx context.Context) (*AuthCheckPostOK, error) {
	userID, ok := getAuthenticatedUser(ctx)
	if !ok {
		return nil, ErrNotLoggedIn
	}
	return &AuthCheckPostOK{UserID: UserID(userID)}, nil
}

func (h *phandler) AuthMeGet(ctx context.Context) (*AuthMeGetOK, error) {
	userID, ok := getAuthenticatedUser(ctx)
	if !ok {
		return nil, ErrNotLoggedIn
	}
	user, err := h.Users.Get(userID)
	if err != nil {
		return nil, err
	}
	return &AuthMeGetOK{User: mapUser(user)}, nil
}

func (h *phandler) AuthAuthenticatePost(ctx context.Context, req *AuthenticateReq) (*AuthenticateOK, error) {
	token, user, err := h.loginAndCreateSession(ctx, req)
	if err != nil {
		return nil, err
	}
	return &AuthenticateOK{
		Token: Token(token),
		User:  user,
	}, nil
}

func (h *phandler) AuthAuthenticateBrowserPost(ctx context.Context, req *AuthenticateReq) (*AuthenticateBrowserOKHeaders, error) {
	token, user, err := h.loginAndCreateSession(ctx, req)
	if err != nil {
		return nil, err
	}
	return &AuthenticateBrowserOKHeaders{
		SetCookie: NewOptSetSessionCookieHeader(SetSessionCookieHeader(createSessionCookie(h.Config.Server.Domain, token).String())),
		Response: AuthenticateBrowserOK{
			User: user,
		},
	}, nil
}

func (h *phandler) AuthRevokePost(_ context.Context, req *AuthRevokeReq) error {
	return h.Sessions.Revoke(string(req.Token))
}

func (h *phandler) AuthRevokeBrowserPost(ctx context.Context) (*AuthRevokeBrowserPostOKHeaders, error) {
	token, ok := getSessionToken(ctx)
	if !ok {
		return nil, ErrNotLoggedIn
	}

	err := h.Sessions.Revoke(token)
	if err != nil {
		return nil, err
	}

	cookie := createSessionCookie(h.Config.Server.Domain, "")
	cookie.MaxAge = -1

	return &AuthRevokeBrowserPostOKHeaders{
		SetCookie: NewOptString(cookie.String()),
		Response:  AuthRevokeBrowserPostOK{},
	}, nil
}

func (h *phandler) AuthRegisterBrowserPost(ctx context.Context, req *AuthRegisterRequest) (*AuthenticateBrowserOKHeaders, error) {
	token, user, err := h.registerAndCreateSession(ctx, req)
	if err != nil {
		return nil, err
	}
	return &AuthenticateBrowserOKHeaders{
		SetCookie: NewOptSetSessionCookieHeader(SetSessionCookieHeader(createSessionCookie(h.Config.Server.Domain, token).String())),
		Response: AuthenticateBrowserOK{
			User: user,
		},
	}, nil
}

func (h *phandler) AuthRegisterPost(ctx context.Context, req *AuthRegisterRequest) (*AuthenticateOK, error) {
	token, user, err := h.registerAndCreateSession(ctx, req)
	if err != nil {
		return nil, err
	}
	return &AuthenticateOK{
		Token: Token(token),
		User:  user,
	}, nil
}

func (h *phandler) registerAndCreateSession(ctx context.Context, req *AuthRegisterRequest) (string, User, error) {
	userData, err := h.Users.Register(prepo.UserRegistration{
		Name:     req.Name,
		Email:    req.Email,
		Password: req.Password,
	})
	if err != nil {
		return "", User{}, err
	}
	user := mapUser(userData)

	token, err := h.createSessionFor(ctx, user)
	if err != nil {
		return "", User{}, err
	}

	return token, user, nil
}

func (h *phandler) loginAndCreateSession(ctx context.Context, req *AuthenticateReq) (string, User, error) {
	userData, err := h.Users.CheckLogin(req.Email, req.Password)
	if err != nil {
		return "", User{}, err
	}
	user := mapUser(userData)

	token, err := h.createSessionFor(ctx, user)
	if err != nil {
		return "", User{}, err
	}

	return token, user, nil
}

func (h *phandler) createSessionFor(ctx context.Context, user User) (string, error) {
	clientInfo := getClientInfo(ctx)
	return h.Sessions.Create(prepo.SessionCreateOptions{
		UserID:    string(user.ID),
		UserAgent: clientInfo.UserAgent,
		IPAddr:    clientInfo.IPAddr,
	})
}

func createSessionCookie(domain, token string) *http.Cookie {
	return &http.Cookie{
		Name:     sessionCookieName,
		Value:    token,
		Domain:   domain,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   60 * 60 * 24 * 365,
	}
}

func mapUser(data prepo.User) User {
	return User{
		ID:             UserID(data.ID),
		Name:           omitEmptyString(data.Name),
		Email:          data.Email,
		EmailConfirmed: NewOptBool(data.EmailConfirmed),
	}
}
