package osm

import (
	_ "embed"
	"github.com/stretchr/testify/require"
	"testing"
	"time"
)

//go:embed test_samples/traces.rss
var sampleTraceFeed []byte

func TestParseFeed(t *testing.T) {
	_, err := parseTraceFeed([]byte("<"))
	require.Error(t, err)

	v, err := parseTraceFeed(sampleTraceFeed)
	require.NoError(t, err)

	t1 := time.Date(2024, 8, 12, 12, 7, 57, 0, time.UTC)
	t2 := time.Date(2024, 8, 12, 11, 52, 38, 0, time.UTC)
	require.Equal(t, []traceMeta{
		{
			ID:       "11111142",
			Title:    "Title 1",
			Download: "https://www.openstreetmap.org/trace/11111142/data",
			UserID:   "user-1",
			PubDate:  &t1,
			Lng:      9,
			Lat:      10,
		},
		{
			ID:       "11111143",
			Title:    "Title 2",
			Download: "https://www.openstreetmap.org/trace/11111143/data",
			UserID:   "user-2",
			PubDate:  &t2,
			Lng:      14,
			Lat:      11,
		},
	}, v)
}
