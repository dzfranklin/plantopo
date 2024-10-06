package bunnycdn

import (
	"context"
	"fmt"
	"io"
	"net/http"
)

// Inspired by the official java storage library (MIT) <https://github.com/BunnyWay/BunnyCDN.Java.Storage>

// Soft limit of 100 concurrent connections per IP and 50 concurrent uploads per storage zone

type StorageConfig struct {
	Endpoint string
	ZoneName string
	APIKey   string
}

type Storage struct {
	StorageConfig
}

func NewStorage(config StorageConfig) *Storage {
	return &Storage{config}
}

type PutOptions struct {
	ContentType string
}

func (s *Storage) Put(ctx context.Context, path string, data io.Reader, opts *PutOptions) error {
	if opts == nil {
		opts = &PutOptions{}
	}
	if opts.ContentType == "" {
		opts.ContentType = "application/octet-stream"
	}

	url := "https://" + s.Endpoint + "/" + s.ZoneName + "/" + path
	req, reqErr := http.NewRequestWithContext(ctx, "PUT", url, data)
	if reqErr != nil {
		return reqErr
	}

	// Unfortunately sending a Content-Encoding header for precompressed data doesn't work
	req.Header.Set("Content-Type", opts.ContentType)
	req.Header.Set("AccessKey", s.APIKey)
	req.Header.Set("Accept", "application/json")

	resp, doErr := http.DefaultClient.Do(req)
	if doErr != nil {
		return doErr
	}
	defer resp.Body.Close()

	if resp.StatusCode != 201 {
		return fmt.Errorf("bad status code: %d", resp.StatusCode)
	}
	return nil
}
