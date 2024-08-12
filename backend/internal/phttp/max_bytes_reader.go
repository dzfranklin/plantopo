package phttp

import (
	"errors"
	"io"
)

var ErrTooLarge = errors.New("too large")

type MaxBytesReader struct {
	io.ReadCloser
	remainingLimit int64
}

func NewMaxBytesReader(r io.ReadCloser, limit int64) *MaxBytesReader {
	return &MaxBytesReader{r, limit}
}

func (b *MaxBytesReader) Read(p []byte) (n int, err error) {
	if b.remainingLimit <= 0 {
		return 0, ErrTooLarge
	}

	if int64(len(p)) > b.remainingLimit {
		p = p[0:b.remainingLimit]
	}

	n, err = b.ReadCloser.Read(p)
	b.remainingLimit -= int64(n)
	return
}
