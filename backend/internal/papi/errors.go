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
	correlationID := makeCorrelationID()

	if specificErr, ok := perrors.Into[*DefaultErrorResponseStatusCode](err); ok {
		return specificErr
	} else if errors.Is(err, ErrNotLoggedIn) {
		return &DefaultErrorResponseStatusCode{
			StatusCode: http.StatusUnauthorized,
			Response: DefaultError{
				Message: "not logged in",
			},
		}
	} else if specificErr, ok := perrors.Into[*prepo.ErrRateLimited](err); ok {
		return &DefaultErrorResponseStatusCode{
			StatusCode: http.StatusTooManyRequests,
			Response: DefaultError{
				Message:           specificErr.Error(),
				RetryAfterSeconds: NewOptInt(specificErr.RetryAfterSeconds),
			},
		}
	} else if specificErr, ok := perrors.Into[*prepo.ErrValidation](err); ok {
		return &DefaultErrorResponseStatusCode{
			StatusCode: http.StatusUnprocessableEntity,
			Response: DefaultError{
				Message: "invalid input",
				ValidationErrors: NewOptValidationErrors(ValidationErrors{
					GeneralErrors: specificErr.GeneralErrors,
					FieldErrors:   NewOptValidationErrorsFieldErrors(specificErr.FieldErrors),
				}),
			},
		}
	} else if errors.Is(err, prepo.ErrInvalidID) {
		return &DefaultErrorResponseStatusCode{
			StatusCode: http.StatusUnprocessableEntity,
			Response: DefaultError{
				Message: "invalid id",
			},
		}
	} else if errors.Is(err, prepo.ErrInvalidSessionToken) {
		return &DefaultErrorResponseStatusCode{
			StatusCode: http.StatusForbidden,
			Response: DefaultError{
				Message: "invalid session token",
			},
		}
	} else if errors.Is(err, context.Canceled) {
		return &DefaultErrorResponseStatusCode{
			StatusCode: http.StatusRequestTimeout,
			Response:   DefaultError{Message: "request timed out"},
		}
	} else {
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

		return &DefaultErrorResponseStatusCode{
			StatusCode: 500,
			Response: DefaultError{
				Message: userFacingMessage,
			},
		}
	}
}

func makeCorrelationID() string {
	return fmt.Sprintf("cor_%x", prand.CryptoRandHex(16))
}
