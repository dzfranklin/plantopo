package sync_schema

import (
	"math/rand"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIdxBetween(t *testing.T) {
	rng := rand.New(rand.NewSource(0xdeadbeef))
	a := "OO"
	b := "OO)"
	got, err := IdxBetween(rng, a, b)
	require.NoError(t, err)
	require.Equal(t, "OO$)", got)
}
