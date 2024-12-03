package admin

import (
	"context"
	"errors"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"net/http"
)

type userContextKey struct{}

func (app *adminApp) requireAdminExceptLoginPageMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/admin/login" {
			next.ServeHTTP(w, r)
			return
		}

		isAdmin, userID, err := app.checkIsAdmin(r)
		if err != nil {
			app.internalServerError(w, r, err)
			return
		}

		if !isAdmin {
			w.Header().Add("Location", "/admin/login")
			w.WriteHeader(http.StatusTemporaryRedirect)
			_, _ = w.Write([]byte("Forbidden or unauthorized"))
			return
		}

		user, err := app.Users.Get(userID)
		if err != nil {
			app.internalServerError(w, r, err)
			return
		}
		r = r.WithContext(context.WithValue(r.Context(), userContextKey{}, user))

		next.ServeHTTP(w, r)
	})
}

func getUser(ctx context.Context) prepo.User {
	return ctx.Value(userContextKey{}).(prepo.User)
}

func (app *adminApp) checkIsLoggedInButNotAdmin(r *http.Request) bool {
	sessionCookie, err := r.Cookie("session")
	if err != nil {
		return false
	}
	token := sessionCookie.Value

	userID, err := app.Sessions.LookupUser(token)
	if err != nil {
		return false
	}

	isAdmin, err := app.Users.IsAdmin(userID)
	if err != nil {
		return false
	}

	return !isAdmin
}

func (app *adminApp) checkIsAdmin(r *http.Request) (bool, string, error) {
	sessionCookie, err := r.Cookie("session")
	if err != nil {
		if errors.Is(err, http.ErrNoCookie) {
			return false, "", nil
		}
		return false, "", err
	}
	token := sessionCookie.Value

	userID, err := app.Sessions.LookupUser(token)
	if err != nil {
		if errors.Is(err, prepo.ErrInvalidSessionToken) {
			return false, "", nil
		}
		return false, "", err
	}

	isAdmin, err := app.Users.IsAdmin(userID)
	if err != nil {
		return false, "", err
	}

	return isAdmin, userID, nil
}
