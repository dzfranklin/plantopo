package papi

import (
	"context"
	"errors"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/perrors"
	"github.com/dzfranklin/plantopo/backend/internal/prand"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"net/http"
	"runtime/debug"
)

var ErrNotLoggedIn = errors.New("not logged in")

func (h *phandler) NewError(ctx context.Context, err error) *DefaultErrorResponseStatusCode {
	return HandleDefaultErrorResponse(h.Env, ctx, err)
}

func HandleDefaultErrorResponse(env *pconfig.Env, _ context.Context, err error) *DefaultErrorResponseStatusCode {
	if specificErr, ok := perrors.Into[*DefaultErrorResponseStatusCode](err); ok {
		specificErr.Response.Code = specificErr.StatusCode
		return specificErr
	} else if errors.Is(err, ErrNotLoggedIn) {
		return statusResponse(http.StatusUnauthorized, "not logged in")
	} else if specificErr, ok := perrors.Into[*prepo.ErrRateLimited](err); ok {
		resp := statusResponse(http.StatusTooManyRequests, specificErr.Error())
		resp.Response.RetryAfterSeconds = NewOptInt(specificErr.RetryAfterSeconds)
		return resp
	} else if specificErr, ok := perrors.Into[*prepo.ErrValidation](err); ok {
		resp := statusResponse(http.StatusUnprocessableEntity, "invalid input")
		resp.Response.ValidationErrors = NewOptValidationErrors(ValidationErrors{
			GeneralErrors: specificErr.GeneralErrors,
			FieldErrors:   NewOptValidationErrorsFieldErrors(specificErr.FieldErrors),
		})
		return resp
	} else if errors.Is(err, prepo.ErrInvalidID) {
		return statusResponse(http.StatusUnprocessableEntity, "invalid id")
	} else if errors.Is(err, prepo.ErrInvalidSessionToken) {
		return statusResponse(http.StatusUnauthorized, "invalid session token")
	} else if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return statusResponse(http.StatusInternalServerError, "server timed out processing request")
	} else if errors.Is(err, prepo.ErrNotFound) {
		return statusResponse(http.StatusNotFound, "")
	} else {
		correlationID := makeCorrelationID()
		stack := string(debug.Stack())
		userFacingMessage := fmt.Sprintf("internal server error (correlation id %s)", correlationID)

		if env.Config.Env == "development" {
			debug.PrintStack()
			userFacingMessage += fmt.Sprintf(": %+v", err)
			stack = "<omitted in development mode for clarity>"
		}

		env.Logger.Error("internal server error",
			"error", err,
			"correlationID", correlationID,
			"stack", stack)

		return statusResponse(http.StatusInternalServerError, userFacingMessage)
	}
}

func makeCorrelationID() string {
	return fmt.Sprintf("cor_%x", prand.CryptoRandHex(16))
}
