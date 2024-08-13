package phttp

import (
	"context"
	"fmt"
	"golang.org/x/net/publicsuffix"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"strings"
	"unicode/utf8"
)

type Client struct {
	opts *Options
	h    http.Client
}

type Options struct {
	// Defaults to the package variable [UserAgent]
	UserAgent string
	// Whether to use a cookie jar to save cookies between requests
	SaveCookies bool
	// Whether to return ErrHTTPStatus for status codes >= 400
	ErrOnStatus bool
}

type ErrHTTPStatus struct {
	Code   int
	Method string
	URL    string
	// Only present if less than 10 KiB and valid UTF-8
	Body string
}

func (err ErrHTTPStatus) Error() string {
	msg := fmt.Sprintf("http status %s %d: %s %s",
		http.StatusText(err.Code), err.Code,
		err.Method, err.URL)
	if err.Body != "" {
		msg += ": " + err.Body
	}
	return msg
}

func New(opts *Options) *Client {
	if opts == nil {
		opts = &Options{}
	}
	if opts.UserAgent == "" {
		opts.UserAgent = UserAgent
	}

	h := http.Client{}

	if opts.SaveCookies {
		jar, err := cookiejar.New(&cookiejar.Options{
			PublicSuffixList: publicsuffix.List,
		})
		if err != nil {
			panic("failed to create cookie jar")
		}
		h.Jar = jar
	}

	return &Client{opts, h}
}

func (c *Client) Get(ctx context.Context, url string) (resp *http.Response, err error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	return c.Do(ctx, req)
}

func (c *Client) Head(ctx context.Context, url string) (resp *http.Response, err error) {
	req, err := http.NewRequest("HEAD", url, nil)
	if err != nil {
		return nil, err
	}
	return c.Do(ctx, req)
}

func (c *Client) Post(ctx context.Context, url, contentType string, body io.Reader) (resp *http.Response, err error) {
	req, err := http.NewRequest("POST", url, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", contentType)
	return c.Do(ctx, req)
}

func (c *Client) PostForm(ctx context.Context, url string, data url.Values) (resp *http.Response, err error) {
	return c.Post(ctx, url, "application/x-www-form-urlencoded", strings.NewReader(data.Encode()))
}

func (c *Client) Do(ctx context.Context, req *http.Request) (*http.Response, error) {
	req = req.WithContext(ctx)
	req.Header.Set("User-Agent", c.opts.UserAgent)

	resp, err := c.h.Do(req)
	if err != nil {
		return nil, err
	}

	if c.opts.ErrOnStatus && resp.StatusCode >= 400 {
		body := ""
		bodyReader := NewMaxBytesReader(resp.Body, 10*1024)
		if bodyBytes, err := io.ReadAll(bodyReader); err == nil {
			if utf8.Valid(bodyBytes) {
				body = string(bodyBytes)
			}
		}

		return nil, ErrHTTPStatus{
			Code:   resp.StatusCode,
			Method: req.Method,
			URL:    req.URL.String(),
			Body:   body,
		}
	}

	return resp, nil
}

func (c *Client) CloseIdleConnections() {
	c.h.CloseIdleConnections()
}
