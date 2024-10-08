package pstaticmap

import (
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/ptest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"log/slog"
	"sync"
	"testing"
)

func Test_tileCache(t *testing.T) {
	var requestsMu sync.Mutex
	var requests int

	subject := newTileCache(ptest.DiscardLogger(), func(_ context.Context, _ *slog.Logger, z, x, y int) ([]byte, error) {
		requestsMu.Lock()
		requests++
		requestsMu.Unlock()

		assert.Equal(t, 1, z)
		assert.Equal(t, 2, x)
		assert.Equal(t, 3, y)

		return []byte(`hello world`), nil
	})

	var wg sync.WaitGroup
	for range 10_000 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			value, err := subject.Get(context.Background(), 1, 2, 3)
			require.NoError(t, err)
			assert.Equal(t, "hello world", string(value))
		}()
	}
	wg.Wait()

	// There is a logic-level race condition that permits a slight amount of
	// duplication if requests take very little time. That is fine because
	// duplication doesn't need to be perfect as it is only to reduce upstream load.
	assert.Less(t, requests, 10)
}
