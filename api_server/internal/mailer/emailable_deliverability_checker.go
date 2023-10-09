package mailer

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/danielzfranklin/plantopo/api_server/internal/logger"
	"go.uber.org/zap"
)

var emailableVerifyRPS = 20 // requests per second

type EmailableDeliverabilityChecker struct {
	ctx     context.Context
	l       *zap.SugaredLogger
	limiter chan struct{}
	apiKey  string
}

func NewEmailableDeliverabilityChecker(
	ctx context.Context, apiKey string,
) *EmailableDeliverabilityChecker {
	l := logger.FromCtx(ctx).Sugar().Named("emailable_deliverability_checker")

	limiter := make(chan struct{}, emailableVerifyRPS)
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case <-time.After(1 * time.Second):
				// refill the chan up to emailableVerifyRPS
				for i := 0; i < emailableVerifyRPS; i++ {
					select {
					case limiter <- struct{}{}:
					default:
					}
				}
			}
		}
	}()

	return &EmailableDeliverabilityChecker{
		ctx:     ctx,
		l:       l,
		limiter: limiter,
		apiKey:  apiKey,
	}
}

type emailableVerifyReply struct {
	DidYouMean string `json:"did_you_mean"`
	State      string `json:"state"`
}

func (c *EmailableDeliverabilityChecker) CheckDeliverable(
	ctx context.Context, email string,
) (bool, error) {
	select {
	case <-ctx.Done():
		return false, ctx.Err()
	case <-c.limiter:
	}
	u := "https://api.emailable.com/v1/verify?email=" + url.QueryEscape(email)
	req, err := http.NewRequestWithContext(ctx, "GET", u, nil)
	if err != nil {
		return false, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return false, fmt.Errorf("do request: %w", err)
	}

	var body []byte
	if resp.Body != nil {
		defer resp.Body.Close()
		body, err = io.ReadAll(resp.Body)
		if err != nil {
			c.l.Errorw("error reading response body",
				"status", resp.StatusCode, "error", err)
			return false, fmt.Errorf("read response body: %w", err)
		}
	}

	if resp.StatusCode != http.StatusOK {
		c.l.Errorw("error from emailable",
			"status", resp.StatusCode, "body", string(body))
		return false, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var reply emailableVerifyReply
	err = json.Unmarshal([]byte(body), &reply)
	if err != nil {
		c.l.Errorw("error unmarshaling response body",
			"status", resp.StatusCode, "body", string(body), "error", err)
		return false, fmt.Errorf("unmarshal response body: %w", err)
	}

	if reply.State == "undeliverable" {
		c.l.Infow("emailable says not deliverable",
			"email", email, "state", reply.State, "body", string(body))
		return false, nil
	} else {
		return true, nil
	}
}
