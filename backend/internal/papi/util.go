package papi

import (
	"bytes"
	"compress/gzip"
	"context"
	"github.com/tidwall/geojson"
	"net/http"
	"time"
)

func omitEmptyString(v string) OptString {
	if v == "" {
		return OptString{}
	} else {
		return OptString{Value: v, Set: true}
	}
}

func omitEmptyInt(v int) OptInt {
	if v == 0 {
		return OptInt{}
	} else {
		return OptInt{Value: v, Set: true}
	}
}

func omitEmptyDateTime(v time.Time) OptDateTime {
	if v.IsZero() {
		return OptDateTime{}
	} else {
		return OptDateTime{Value: v, Set: true}
	}
}

func mapGeometry(v geojson.Object) Geometry {
	return Geometry(v.JSON())
}

func mvtResponse(ctx context.Context, value []byte) (*MVTTileHeaders, error) {
	if acceptsEncoding(ctx, "gzip") {
		var b bytes.Buffer
		w := gzip.NewWriter(&b)
		if _, err := w.Write(value); err != nil {
			return nil, nil
		}
		if err := w.Close(); err != nil {
			return nil, nil
		}
		return &MVTTileHeaders{
			ContentEncoding: NewOptString("gzip"),
			Response:        MVTTile{Data: &b},
		}, nil
	} else {
		return &MVTTileHeaders{
			Response: MVTTile{Data: bytes.NewReader(value)},
		}, nil
	}
}

func NewPoint(v [2]float64) Point {
	return Point{v[0], v[1]}
}

func badRequest(msg string) *DefaultErrorResponseStatusCode {
	return statusResponse(http.StatusBadRequest, msg)
}

func forbidden(msg string) *DefaultErrorResponseStatusCode {
	return statusResponse(http.StatusForbidden, msg)
}

func statusResponse(status int, msg string) *DefaultErrorResponseStatusCode {
	if msg == "" {
		msg = http.StatusText(status)
	}
	return &DefaultErrorResponseStatusCode{
		StatusCode: status,
		Response:   DefaultError{Code: status, Message: msg},
	}
}
