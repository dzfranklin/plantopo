package pflickr

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/cenkalti/backoff/v4"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/phttp"
	"github.com/dzfranklin/plantopo/backend/internal/ptime"
	"github.com/throttled/throttled/v2"
	throttledredisstore "github.com/throttled/throttled/v2/store/goredisstore.v9"
	"github.com/tidwall/geojson/geometry"
	"log/slog"
	"net/url"
	"strconv"
	"time"
	"unicode/utf8"
)

// NOTE: At least for early photos flickr returns the wrong size.

var apiQuota = throttled.RateQuota{MaxRate: throttled.PerSec(1), MaxBurst: 0}

type API struct {
	l        *slog.Logger
	c        *phttp.JSONClient
	throttle *throttled.GCRARateLimiterCtx
}

func NewAPI(env *pconfig.Env) *API {
	c := phttp.NewJSONClient("https://www.flickr.com/services/rest/")
	c.AddCommonQueryParam("api_key", env.Config.Flickr.APIKey)

	throttleStore, err := throttledredisstore.NewCtx(env.RDB, "flickr_throttle")
	if err != nil {
		panic(err)
	}
	throttle, err := throttled.NewGCRARateLimiterCtx(throttleStore, apiQuota)
	if err != nil {
		panic(err)
	}

	return &API{l: env.Logger, c: c, throttle: throttle}
}

type searchParams struct {
	BBox          geometry.Rect
	MaxUploadDate time.Time // inclusive
	MinUploadDate time.Time // inclusive
	Page          int
}

type searchPage struct {
	Page    int               `json:"page"`
	Pages   int               `json:"pages"`
	PerPage int               `json:"perpage"`
	Total   int               `json:"total"`
	Photo   []searchPagePhoto `json:"photo"`
}

type partialSearchPage struct {
	Page    int               `json:"page"`
	Pages   int               `json:"pages"`
	PerPage int               `json:"perpage"`
	Total   int               `json:"total"`
	Photo   []json.RawMessage `json:"photo"`
}

type searchPagePhoto struct {
	ID             string     `json:"id,omitempty"`
	Owner          string     `json:"owner,omitempty"`
	License        int        `json:"license,string,omitempty"`
	OwnerName      string     `json:"ownername,omitempty"`
	Longitude      fuzzyFloat `json:"longitude"`
	Latitude       fuzzyFloat `json:"latitude"`
	DateUpload     fuzzyDate  `json:"dateupload"`
	DateTaken      fuzzyDate  `json:"datetaken"`
	Title          string     `json:"title,omitempty"`
	OriginalURL    string     `json:"url_o,omitempty"`
	OriginalWidth  int        `json:"width_o,omitempty"`
	OriginalHeight int        `json:"height_o,omitempty"`
	SmallURL       string     `json:"url_s,omitempty"`
	SmallWidth     int        `json:"width_s,omitempty"`
	SmallHeight    int        `json:"height_s,omitempty"`
	LargeURL       string     `json:"url_l,omitempty"`
	LargeWidth     int        `json:"width_l,omitempty"`
	LargeHeight    int        `json:"height_l,omitempty"`
}

func (a *API) searchForIndex(ctx context.Context, params searchParams) (searchPage, error) {
	var container struct {
		Photos partialSearchPage `json:"photos"`
	}
	callErr := a.call(ctx, "flickr.photos.search", &container, map[string]string{
		"format":          "json",
		"nojsoncallback":  "1",
		"bbox":            fmt.Sprintf("%.6f,%.6f,%.6f,%.6f", params.BBox.Min.X, params.BBox.Min.Y, params.BBox.Max.X, params.BBox.Max.Y),
		"min_upload_date": fmt.Sprintf("%d", params.MinUploadDate.Unix()),
		"max_upload_date": fmt.Sprintf("%d", params.MaxUploadDate.Unix()),
		"page":            fmt.Sprintf("%d", params.Page),
		"sort":            "date-posted-asc",
		"safe_search":     "1",
		"content_types":   "0",
		"extras":          "owner_name,license,date_taken,date_upload,geo,url_o,url_l,url_s",
	})
	if callErr != nil {
		return searchPage{}, callErr
	}
	resp := container.Photos

	photos := make([]searchPagePhoto, 0, len(resp.Photo))
	for _, entry := range resp.Photo {
		var photo searchPagePhoto
		photoErr := json.Unmarshal(entry, &photo)
		if photoErr != nil {
			a.l.Error("failed to deserialize flickr photo",
				"entry", string(entry), "error", photoErr)
			return searchPage{}, photoErr
		}
		photos = append(photos, photo)
	}

	return searchPage{
		Page:    resp.Page,
		Pages:   resp.Pages,
		PerPage: resp.PerPage,
		Total:   resp.Total,
		Photo:   photos,
	}, nil
}

func (a *API) call(ctx context.Context, method string, resp any, params map[string]string) error {
	query := url.Values{}
	for k, v := range params {
		query.Set(k, v)
	}
	query.Set("method", method)
	return backoff.Retry(func() error {
		limited, limit, limitErr := a.throttle.RateLimitCtx(ctx, "call", 1)
		if limitErr != nil {
			return limitErr
		}
		if limited {
			a.l.Debug("sleeping", "dur", limit.RetryAfter.String())
			if err := ptime.Sleep(ctx, limit.RetryAfter); err != nil {
				return err
			}
		}
		a.l.Info("requesting", "query", query.Encode())
		err := a.c.Get(ctx, resp, "?"+query.Encode())
		if err != nil {
			if !errors.Is(err, context.Canceled) {
				a.l.Warn("failed to get", "error", err)
			}
			return err
		}
		return nil
	}, backoff.WithContext(backoff.NewExponentialBackOff(), ctx))
}

type fuzzyDate time.Time

func (f fuzzyDate) MarshalJSON() ([]byte, error) {
	return time.Time(f).UTC().MarshalJSON()
}

func (f *fuzzyDate) UnmarshalJSON(data []byte) error {
	if !utf8.Valid(data) {
		return errors.New("non utf-8")
	}

	var value string
	if err := json.Unmarshal(data, &value); err != nil {
		return err
	}

	var t time.Time
	if asInt, intErr := strconv.ParseInt(value, 10, 64); intErr == nil {
		t = time.Unix(asInt, 0)
	} else if asTime, timeErr := time.Parse("2006-01-02 15:04:05", value); timeErr == nil {
		t = asTime
	} else {
		return fmt.Errorf("cannot parse \"%s\" as fuzzyDate", string(data))
	}

	*f = fuzzyDate(t.UTC())
	return nil
}

type fuzzyFloat float64

func (f fuzzyFloat) MarshalJSON() ([]byte, error) {
	return json.Marshal(float64(f))
}

func (f *fuzzyFloat) UnmarshalJSON(data []byte) error {
	var numericValue float64
	if err := json.Unmarshal(data, &numericValue); err == nil {
		*f = fuzzyFloat(numericValue)
		return nil
	}

	var stringValue string
	if unmarshalErr := json.Unmarshal(data, &stringValue); unmarshalErr == nil {
		v, parseErr := strconv.ParseFloat(stringValue, 64)
		if parseErr == nil {
			*f = fuzzyFloat(v)
			return nil
		}
	}

	return fmt.Errorf("cannot parse \"%s\" as fuzzyFloat", string(data))
}
