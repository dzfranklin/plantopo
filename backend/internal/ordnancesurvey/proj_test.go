package ordnancesurvey

import (
	"github.com/stretchr/testify/require"
	"github.com/twpayne/go-proj/v10"
	"testing"
)

func TestNewFromBNG(t *testing.T) {
	pj := newFromBNG()
	lnglat, err := pj.Forward(proj.NewCoord(216666, 771288, 0, 0))
	require.NoError(t, err)
	require.InDelta(t, lnglat.Y(), -5.003683, 0.0000009) // longitude
	require.InDelta(t, lnglat.X(), 56.796887, 0.0000009) // latitude
}
