package jsonclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

type Client struct {
	h         *http.Client
	baseURL   string
	userAgent string
}

func New(baseURL string, userAgent string) *Client {
	return &Client{
		h:         &http.Client{},
		baseURL:   baseURL,
		userAgent: userAgent,
	}
}

func (c *Client) Get(ctx context.Context, out any, path string) error {
	return c.Do(ctx, out, http.MethodGet, path, nil)
}

func (c *Client) Post(ctx context.Context, out any, path string, body any) error {
	return c.Do(ctx, out, http.MethodPost, path, body)
}

func (c *Client) Do(ctx context.Context, out any, method string, path string, body any) error {
	reqURL := c.baseURL
	if path != "" {
		if !strings.HasSuffix(reqURL, "/") {
			reqURL += "/"
		}
		reqURL += path
	}

	var serBody *bytes.Reader
	if body != nil {
		serBodyBytes, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("failed to serialize request body: %w", err)
		}
		serBody = bytes.NewReader(serBodyBytes)
	}

	req, err := http.NewRequestWithContext(ctx, method, reqURL, serBody)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", c.userAgent)

	resp, err := c.h.Do(req)
	if err != nil {
		return fmt.Errorf("failed to perform request: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		var errBody string
		fullBody, err := io.ReadAll(resp.Body)
		if err != nil {
			errBody = "<failed to read body>"
		} else {
			errBody = string(fullBody[:min(len(fullBody), 500)])
			if len(errBody) < len(fullBody) {
				errBody += "..."
			}
		}

		return fmt.Errorf("unexpected status code %d: %s", resp.StatusCode, errBody)
	}

	return json.NewDecoder(resp.Body).Decode(out)
}
