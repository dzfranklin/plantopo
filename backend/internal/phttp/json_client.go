package phttp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/perrors"
	"github.com/dzfranklin/plantopo/backend/internal/ptime"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

type JSONClient struct {
	c                 *Client
	baseURL           string
	commonHeaders     http.Header
	commonQueryParams url.Values
}

func NewJSONClient(baseURL string) *JSONClient {
	commonHeaders := make(http.Header)
	commonHeaders.Set("Accept", "application/json")
	commonHeaders.Set("User-Agent", UserAgent)

	return &JSONClient{
		c:             New(nil),
		baseURL:       baseURL,
		commonHeaders: commonHeaders,
	}
}

func (c *JSONClient) SetCommonHeader(k, v string) {
	if c.commonHeaders == nil {
		c.commonHeaders = make(http.Header)
	}
	c.commonHeaders.Set(k, v)
}

func (c *JSONClient) AddCommonQueryParam(k, v string) {
	if c.commonQueryParams == nil {
		c.commonQueryParams = make(url.Values)
	}
	c.commonQueryParams.Add(k, v)
}

func (c *JSONClient) Get(ctx context.Context, out any, path string) error {
	return c.Do(ctx, out, http.MethodGet, path, nil)
}

func (c *JSONClient) Post(ctx context.Context, out any, path string, body any) error {
	return c.Do(ctx, out, http.MethodPost, path, body)
}

func (c *JSONClient) Do(ctx context.Context, out any, method string, path string, body any) error {
	err := c.do(ctx, out, method, path, body)

	if v, ok := perrors.Into[ErrHTTPStatus](err); ok && v.Code == http.StatusTooManyRequests {
		resetAt := time.Now().Add(time.Minute)

		resetTS, err := strconv.ParseInt(v.Header.Get("X-Rate-Limit-Reset"), 10, 64)
		if err != nil {
			resetAt = time.Unix(resetTS, 0)
		}

		if err := ptime.SleepUntil(ctx, resetAt); err != nil {
			return err
		}

		return c.Do(ctx, out, method, path, body)
	}

	return err
}

func (c *JSONClient) do(ctx context.Context, out any, method string, path string, body any) error {
	if ctx.Err() != nil {
		return ctx.Err()
	}

	reqURL := c.baseURL
	if path != "" {
		if !strings.HasSuffix(reqURL, "/") {
			reqURL += "/"
		}
		reqURL += path
	}

	var serBody io.Reader
	if body != nil {
		serBodyBytes, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("failed to serialize request body: %w", err)
		}
		serBody = bytes.NewReader(serBodyBytes)
	}

	req, err := http.NewRequest(method, reqURL, serBody)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	for k, v := range c.commonHeaders {
		req.Header.Set(k, v[0])
	}

	if c.commonQueryParams != nil {
		q := req.URL.Query()
		for k, vs := range c.commonQueryParams {
			for _, v := range vs {
				q.Add(k, v)
			}
		}
		req.URL.RawQuery = q.Encode()
	}

	resp, err := c.c.Do(ctx, req)
	if err != nil {
		return err
	}

	return json.NewDecoder(resp.Body).Decode(out)
}
