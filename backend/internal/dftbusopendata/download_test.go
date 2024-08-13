package dftbusopendata

import (
	"context"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/ptest"
	"github.com/stretchr/testify/require"
	"io"
	"os"
	"testing"
)

func TestDownloadScotlandSmoke(t *testing.T) {
	t.Skip()

	ptest.LoadDevEnv(t)
	username := os.Getenv("DFT_BUS_OPEN_DATA_USERNAME")
	password := os.Getenv("DFT_BUS_OPEN_DATA_PASSWORD")
	if username == "" || password == "" {
		panic("This smoke test requires DFT_USERNAME and DFT_PASSWORD")
	}

	gtfs, err := DownloadScotland(context.Background(), username, password)
	require.NoError(t, err)

	f, err := os.CreateTemp("", "*.gtfs.zip")
	require.NoError(t, err)

	bytesWritten, err := io.Copy(f, gtfs)
	require.NoError(t, err)

	err = gtfs.Close()
	require.NoError(t, err)

	err = f.Close()
	require.NoError(t, err)

	fmt.Printf("Wrote %d MiB to %s\n", bytesWritten/1024/1024, f.Name())
}
