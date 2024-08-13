package phttp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/pstrings"
	"io"
	"net/http"
	"net/url"
	"strings"
)

const traceRequests = false

type JSONClient struct {
	h                 *http.Client
	baseURL           string
	commonHeaders     http.Header
	commonQueryParams url.Values
}

func NewJSONClient(baseURL string) *JSONClient {
	commonHeaders := make(http.Header)
	commonHeaders.Set("Accept", "application/json")
	commonHeaders.Set("User-Agent", UserAgent)

	return &JSONClient{
		h:             &http.Client{},
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

	req, err := http.NewRequestWithContext(ctx, method, reqURL, serBody)
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

	if traceRequests {
		fmt.Printf("TRACE REQUEST %+v\n", req)
	}

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
			errBody = pstrings.TruncateASCII(string(fullBody), 400)
		}

		return fmt.Errorf("unexpected status code %d: %s %s: %s", resp.StatusCode, method, reqURL, errBody)
	}

	return json.NewDecoder(resp.Body).Decode(out)
}
