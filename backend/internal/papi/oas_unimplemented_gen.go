// Code generated by ogen, DO NOT EDIT.

package papi

import (
	"context"

	ht "github.com/ogen-go/ogen/http"
)

// UnimplementedHandler is no-op Handler which returns http.ErrNotImplemented.
type UnimplementedHandler struct{}

var _ Handler = UnimplementedHandler{}

// AuthAuthenticateBrowserPost implements POST /auth/authenticate-browser operation.
//
// This sets a cookie authenticating you as the given user. The cookie will only work on plantopo.com.
//
// POST /auth/authenticate-browser
func (UnimplementedHandler) AuthAuthenticateBrowserPost(ctx context.Context, req *AuthenticateReq) (r *AuthenticateBrowserOKHeaders, _ error) {
	return r, ht.ErrNotImplemented
}

// AuthAuthenticatePost implements POST /auth/authenticate operation.
//
// Authenticate as a user (see /auth/authenticate-browser if you are the frontend).
//
// POST /auth/authenticate
func (UnimplementedHandler) AuthAuthenticatePost(ctx context.Context, req *AuthenticateReq) (r *AuthenticateOK, _ error) {
	return r, ht.ErrNotImplemented
}

// AuthCheckPost implements POST /auth/check operation.
//
// Check if you are authenticated.
//
// POST /auth/check
func (UnimplementedHandler) AuthCheckPost(ctx context.Context) (r *AuthCheckPostOK, _ error) {
	return r, ht.ErrNotImplemented
}

// AuthRegisterBrowserPost implements POST /auth/register-browser operation.
//
// Register a new account and store the token in the requesting browser's cookie jar.
//
// POST /auth/register-browser
func (UnimplementedHandler) AuthRegisterBrowserPost(ctx context.Context, req *AuthRegisterRequest) (r *AuthenticateBrowserOKHeaders, _ error) {
	return r, ht.ErrNotImplemented
}

// AuthRegisterPost implements POST /auth/register operation.
//
// Register a new account.
//
// POST /auth/register
func (UnimplementedHandler) AuthRegisterPost(ctx context.Context, req *AuthRegisterRequest) (r *AuthenticateOK, _ error) {
	return r, ht.ErrNotImplemented
}

// AuthRevokeBrowserPost implements POST /auth/revoke-browser operation.
//
// Revokes the cookie set by /auth/authenticate-browser.
//
// POST /auth/revoke-browser
func (UnimplementedHandler) AuthRevokeBrowserPost(ctx context.Context) (r *AuthRevokeBrowserPostOKHeaders, _ error) {
	return r, ht.ErrNotImplemented
}

// AuthRevokePost implements POST /auth/revoke operation.
//
// Revoke a token.
//
// POST /auth/revoke
func (UnimplementedHandler) AuthRevokePost(ctx context.Context, req *AuthRevokeReq) error {
	return ht.ErrNotImplemented
}

// ElevationPost implements POST /elevation operation.
//
// Lookup elevations for a list of coordinates.
//
// POST /elevation
func (UnimplementedHandler) ElevationPost(ctx context.Context, req *ElevationPostReq) (r *ElevationPostOK, _ error) {
	return r, ht.ErrNotImplemented
}

// WeatherShortUkGet implements GET /weather/short-uk operation.
//
// Find short format weather forecasts for a place in the UK.
//
// GET /weather/short-uk
func (UnimplementedHandler) WeatherShortUkGet(ctx context.Context, params WeatherShortUkGetParams) (r WeatherShortUkGetOK, _ error) {
	return r, ht.ErrNotImplemented
}

// NewError creates *DefaultErrorResponseStatusCode from error returned by handler.
//
// Used for common default response.
func (UnimplementedHandler) NewError(ctx context.Context, err error) (r *DefaultErrorResponseStatusCode) {
	r = new(DefaultErrorResponseStatusCode)
	return r
}