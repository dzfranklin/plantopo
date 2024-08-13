package dftbusopendata

import (
	"context"
	"errors"
	"fmt"
	"github.com/andybalholm/cascadia"
	"github.com/dzfranklin/plantopo/backend/internal/phttp"
	"golang.org/x/net/html"
	"io"
	"net/http"
	"net/url"
	"strings"
)

var loginCSRFMiddlewareInput = cascadia.MustCompile("input[name=csrfmiddlewaretoken]")

func DownloadScotland(ctx context.Context, username, password string) (io.ReadCloser, error) {
	c := phttp.New(&phttp.Options{SaveCookies: true, ErrOnStatus: true})

	// GET /account/login for csrf cookie and input value

	loginResp, err := c.Get(ctx, "https://data.bus-data.dft.gov.uk/account/login/")
	if err != nil {
		return nil, err
	}

	loginDoc, err := html.Parse(loginResp.Body)
	if err != nil {
		return nil, fmt.Errorf("parse login body: %w", err)
	}

	csrfNode := cascadia.Query(loginDoc, loginCSRFMiddlewareInput)
	if csrfNode == nil {
		return nil, errors.New("missing csrf input")
	}

	var csrfToken string
	for _, attr := range csrfNode.Attr {
		if attr.Key == "value" {
			csrfToken = attr.Val
			break
		}
	}
	if csrfToken == "" {
		return nil, errors.New("missing csrf value")
	}

	// POST /account/login for cookie

	loginData := url.Values{}
	loginData.Set("csrfmiddlewaretoken", csrfToken)
	loginData.Set("login", username)
	loginData.Set("password", password)
	loginData.Set("submit", "submit")

	loginReq, err := http.NewRequest("POST", "https://data.bus-data.dft.gov.uk/account/login/", strings.NewReader(loginData.Encode()))
	if err != nil {
		return nil, err
	}

	loginReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	loginReq.Header.Set("Referer", "https://data.bus-data.dft.gov.uk/account/login/")
	loginReq.Header.Set("Origin", "https://data.bus-data.dft.gov.uk")

	_, err = c.Do(ctx, loginReq)
	if err != nil {
		return nil, err
	}

	// GET /timetable/download/gtfs-file/scotland

	downloadReq, err := http.NewRequest("GET", "https://data.bus-data.dft.gov.uk/timetable/download/gtfs-file/scotland/", nil)
	if err != nil {
		return nil, err
	}
	downloadReq.Header.Set("Referer", "https://data.bus-data.dft.gov.uk/timetable/download/")
	downloadReq.Header.Set("Origin", "https://data.bus-data.dft.gov.uk")

	downloadResp, err := c.Do(ctx, downloadReq)
	if err != nil {
		return nil, err
	}

	return downloadResp.Body, nil
}
