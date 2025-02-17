package phttp

import "net/http"

type roundTripper func(*http.Request) (*http.Response, error)

func (rt roundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	return rt(req)
}

func RoundTripper(fn func(*http.Request) (*http.Response, error)) http.RoundTripper {
	return roundTripper(fn)
}
