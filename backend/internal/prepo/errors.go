package prepo

import (
	"errors"
	"fmt"
	"github.com/throttled/throttled/v2"
	"math"
)

var (
	ErrInvalidID           = errors.New("invalid ID")
	ErrNotFound            = errors.New("not found")
	ErrInvalidSessionToken = errors.New("invalid token")
	ErrInvalidCursor       = errors.New("invalid cursor")
)

type ErrRateLimited struct {
	RetryAfterSeconds int `json:"retry_after_seconds"`
}

func (err *ErrRateLimited) Error() string {
	return fmt.Sprintf("rate limited: retry after %d seconds", err.RetryAfterSeconds)
}

func makeRateLimitedError(res throttled.RateLimitResult) *ErrRateLimited {
	return &ErrRateLimited{
		RetryAfterSeconds: int(math.Round(res.RetryAfter.Seconds())),
	}
}
