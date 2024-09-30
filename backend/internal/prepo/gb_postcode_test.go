package prepo

import (
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/ptest"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/geojson/geometry"
	"testing"
)

func TestGBPostcode(t *testing.T) {
	t.Parallel()
	env := ptest.NewTestEnv(t)

	t.Run("set", func(t *testing.T) {
		env.Reset()
		subject := NewGBPostcode(env.Env)
		ctx := context.Background()

		// Initial set

		p1 := GBPostcodePoint{Code: "WS6 6GE", Point: geometry.Point{X: -2.018901, Y: 52.652213}}
		p2 := GBPostcodePoint{Code: "WS6 6GF", Point: geometry.Point{X: -2.019951, Y: 52.652303}}

		err := subject.Set(ctx, []GBPostcodePoint{p1, p2})
		require.NoError(t, err)

		require.Equal(t, p1, ptest.Must(subject.Get(ctx, p1.Code)))
		require.Equal(t, p2, ptest.Must(subject.Get(ctx, p2.Code)))

		// Subsequent set

		err = subject.Set(ctx, []GBPostcodePoint{p1})
		require.NoError(t, err)

		require.Equal(t, p1, ptest.Must(subject.Get(ctx, p1.Code)))

		_, getP2Err := subject.Get(ctx, p2.Code)
		require.Error(t, getP2Err)
	})

	t.Run("search", func(t *testing.T) {
		env.Reset()
		subject := NewGBPostcode(env.Env)
		ctx := context.Background()

		p1 := GBPostcodePoint{Code: "WS6 6GE", Point: geometry.Point{X: -2.018901, Y: 52.652213}}
		p2 := GBPostcodePoint{Code: "KY16 111", Point: geometry.Point{X: -2.5, Y: 56}}
		p3 := GBPostcodePoint{Code: "KY16 8BX", Point: geometry.Point{X: -2.6, Y: 56}}
		require.NoError(t, subject.Set(ctx, []GBPostcodePoint{p1, p2, p3}))

		// too short
		got, err := subject.Search(ctx, "K", nil)
		require.NoError(t, err)
		require.Empty(t, got)

		// outwards code only
		got, err = subject.Search(ctx, "KY16", nil)
		require.NoError(t, err)
		require.Equal(t, []GBPostcodePoint{p2, p3}, got)

		// outcode and some inwards code
		got, err = subject.Search(ctx, "KY168", nil)
		require.NoError(t, err)
		require.Equal(t, []GBPostcodePoint{p3}, got)

		// with bias
		got, err = subject.Search(ctx, "KY16", &p3.Point)
		require.NoError(t, err)
		require.Equal(t, []GBPostcodePoint{p3, p2}, got)
	})
}
