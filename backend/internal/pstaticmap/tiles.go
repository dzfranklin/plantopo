package pstaticmap

import (
	"context"
	"errors"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/phttp"
	"github.com/hashicorp/golang-lru/v2"
	"golang.org/x/sync/semaphore"
	"golang.org/x/sync/singleflight"
	"io"
	"log/slog"
	"net/http"
	"time"
)

const maxTileBytes = 100_000
const maxConcurrentRequests = 12 // Google Chrome's per-domain limit is 6
const cacheSize = 200_000_000 / maxTileBytes

const tileSize = 256

type tileCache struct {
	l       *slog.Logger
	request func(ctx context.Context, l *slog.Logger, z, x, y int) ([]byte, error)
	grp     singleflight.Group
	sem     *semaphore.Weighted
	cache   *lru.TwoQueueCache[string, []byte]
	http    *http.Client
}

func newTileCache(l *slog.Logger, request func(ctx context.Context, l *slog.Logger, z, x, y int) ([]byte, error)) *tileCache {
	cache, err := lru.New2Q[string, []byte](cacheSize)
	if err != nil {
		panic("failed to initialize lru cache: " + err.Error())
	}
	return &tileCache{
		l:       l,
		request: request,
		sem:     semaphore.NewWeighted(maxConcurrentRequests),
		cache:   cache,
		http:    &http.Client{},
	}
}

func (p *tileCache) Get(ctx context.Context, z, x, y int) ([]byte, error) {
	key := fmt.Sprintf("%d/%d/%d", z, x, y)

	if v, ok := p.cache.Get(key); ok {
		return v, nil
	}

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	out, err, _ := p.grp.Do(key, func() (interface{}, error) {
		if err := p.sem.Acquire(ctx, 1); err != nil {
			return nil, err
		}
		defer p.sem.Release(1)

		value, err := p.request(ctx, p.l, z, x, y)
		if err != nil {
			return nil, err
		}

		p.cache.Add(key, value)

		return value, nil
	})
	if err != nil {
		return nil, err
	}
	return out.([]byte), nil
}

func requestFromOSM(ctx context.Context, l *slog.Logger, z, x, y int) ([]byte, error) {
	url := fmt.Sprintf("https://tile.openstreetmap.org/%d/%d/%d.png", z, x, y)
	l.Info("requesting tile from osm", "url", url)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("User-Agent", phttp.UserAgent)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	value, err := io.ReadAll(io.LimitReader(resp.Body, maxTileBytes))
	if err != nil {
		return nil, err
	}
	if len(value) == maxTileBytes {
		return nil, errors.New("tile too big: " + url)
	}
	return value, nil
}
