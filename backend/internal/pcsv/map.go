package pcsv

import (
	"encoding/csv"
	"errors"
	"io"
)

type MapReader struct {
	inner  *csv.Reader
	header []string
	next   []string
	err    error
}

func NewMapReader(r io.Reader) *MapReader {
	inner := csv.NewReader(r)
	return &MapReader{inner: inner}
}

func (r *MapReader) Next() bool {
	if r.header == nil {
		r.header, r.err = r.inner.Read()
		if r.err != nil {
			return false
		}
	}

	r.next, r.err = r.inner.Read()
	if r.err != nil {
		return false
	}

	if len(r.next) > len(r.header) {
		r.err = errors.New("csv row has more fields than header")
		return false
	}

	return true
}

func (r *MapReader) Value() map[string]string {
	if r.err != nil || r.next == nil {
		panic("cannot call .Value() if .Next() does not return true")
	}

	out := make(map[string]string, len(r.header))
	for i, v := range r.next {
		out[r.header[i]] = v
	}
	return out
}

func (r *MapReader) Error() error {
	if r.err == io.EOF {
		return nil
	}
	return r.err
}
