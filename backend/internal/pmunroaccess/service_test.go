package pmunroaccess

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/ptest"
	"github.com/stretchr/testify/require"
	"os"
	"testing"
	"time"
)

var (
	waverlyStation = [2]float64{-3.1916628, 55.9521829}
	fortWilliam    = [2]float64{-5.1238334, 56.8169543}
)

var smokeEndpoint = "http://geder:4448/otp/gtfs/v1"

func newSmokeClient(t *testing.T) *MunroAccessService {
	return New(&pconfig.Env{
		Config: &pconfig.Config{
			OpenTransitPlanner: pconfig.OpenTransitPlanner{
				GTFSEndpoint: smokeEndpoint,
			},
		},
		Logger: ptest.NewTestLogger(t),
	})
}

func TestBuildMatrixSmoke(t *testing.T) {
	t.Skip()

	c := newSmokeClient(t)
	ctx := context.Background()

	data, err := c.buildMatrix(ctx, waverlyStation, time.Now(), 12, munroStartClusters)
	require.NoError(t, err)

	dataJSON, err := json.MarshalIndent(data, "", "    ")
	require.NoError(t, err)
	err = os.WriteFile("testdata/matrix.json", dataJSON, 0666)
	require.NoError(t, err)
}

func TestBuildMatrixSubsetSmoke(t *testing.T) {
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

	data, err := c.buildMatrix(ctx, waverlyStation, time.Now(), 4, munroStartClusters[:20])
	require.NoError(t, err)

	dataJSON, err := json.MarshalIndent(data, "", "    ")
	require.NoError(t, err)
	err = os.WriteFile("testdata/matrix_subset.json", dataJSON, 0666)
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
