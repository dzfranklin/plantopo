package pmunroaccess

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/stretchr/testify/require"
	"os"
	"testing"
	"time"
)

var (
	waverlyStation = [2]float64{-3.18823, 55.95239}
	dundee         = [2]float64{-2.971971, 56.4576709}
	fortWilliam    = [2]float64{-5.1238334, 56.8169543}
)

var smokeEndpoint = "http://geder:2000/otp/gtfs/v1"

func newSmokeClient(t *testing.T) *GederWorker {
	return NewGederWorker(smokeEndpoint)
}

func TestGenerateSmoke(t *testing.T) {
	t.Skip()

	c := newSmokeClient(t)
	ctx := context.Background()

	date := time.Date(2024, 9, 25, 0, 0, 0, 0, time.UTC) // Saturday

	data, err := c.generate(ctx, dundee, date, 12, munroStartClusters)
	require.NoError(t, err)

	dataJSON, err := json.MarshalIndent(data, "", "    ")
	require.NoError(t, err)

	f, err := os.CreateTemp("", "*.json")
	require.NoError(t, err)

	_, err = f.Write(dataJSON)
	require.NoError(t, err)

	fmt.Println("Wrote to", f.Name())
}

func TestGenerateSubsetSmoke(t *testing.T) {
	t.Skip()

	c := newSmokeClient(t)
	ctx := context.Background()

	// Rough timings by parallelism on my laptop with 20 clusters after a fresh start of otp:
	//   1: 22 sec
	//   2: 16 sec
	//   4: 13 sec
	//   8: 14 sec
	//   10: 12 sec
	//   12: 12 sec
	//   16: 14 sec

	// On my laptop otp seems to use about a core per parallelism

	_, err := c.generate(ctx, waverlyStation, time.Now(), 4, munroStartClusters[:20])
	require.NoError(t, err)
}

func TestQueryOnePairSmoke(t *testing.T) {
	t.Skip()

	c := newSmokeClient(t)
	ctx := context.Background()

	data, err := c.queryOnePair(ctx, time.Now(), waverlyStation, fortWilliam)
	require.NoError(t, err)
	fmt.Println(string(data))
}
