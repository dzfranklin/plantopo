package papi

import (
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

func NewPoint(v [2]float64) Point {
	return Point{v[0], v[1]}
}

func badRequest(msg string) *DefaultErrorResponseStatusCode {
	return &DefaultErrorResponseStatusCode{
		StatusCode: http.StatusBadRequest,
		Response:   DefaultError{Message: msg},
	}
}
