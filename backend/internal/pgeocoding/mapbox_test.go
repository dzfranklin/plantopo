package pgeocoding

import (
	"github.com/dzfranklin/plantopo/backend/internal/ptest"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestPlaceNameSmoke(t *testing.T) {
	t.Skip()
	subject := New(ptest.LoadDevEnv(t))
	got, err := subject.PlaceName(-3.7292664604101162, 56.7154493779839, nil)
	require.NoError(t, err)
	require.Equal(t, "Pitlochry", got)
}
