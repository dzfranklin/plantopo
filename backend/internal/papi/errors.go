package papi

import (
	"context"
	"crypto/rand"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"runtime/debug"
)

func (h *phandler) NewError(ctx context.Context, err error) *ErrorResponseStatusCode {
	return HandleErrorResponse(h.Config, ctx, err)
}

func HandleErrorResponse(cfg *pconfig.Config, _ context.Context, err error) *ErrorResponseStatusCode {
	correlationID := makeCorrelationID()
	stack := string(debug.Stack())
	userFacingMessage := fmt.Sprintf("internal server error (correlation id %s)", correlationID)

	if cfg.Env == "development" {
		debug.PrintStack()
		userFacingMessage += fmt.Sprintf(": %+v", err)
		stack = "<omitted in development mode for clarity>"
	}

	cfg.Logger.Error("internal server error",
		"error", err,
		"correlationID", correlationID,
		"stack", stack)

	return &ErrorResponseStatusCode{
		StatusCode: 500,
		Response: ErrorResponse{
			Message: userFacingMessage,
		},
	}
}

func makeCorrelationID() string {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		panic(err)
	}
	return fmt.Sprintf("cor_%x", buf)
}
