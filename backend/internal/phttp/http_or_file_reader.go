package phttp

import (
	"context"
	"io"
	"os"
	"strings"
)

func OpenRemoteOrLocal(ctx context.Context, path string) (io.ReadCloser, error) {
	if strings.HasPrefix(path, "http://") || strings.HasPrefix(path, "https://") {
		resp, err := Get(ctx, path)
		if err != nil {
			return nil, err
		}
		return resp.Body, nil
	} else {
		return os.Open(path)
	}
}
