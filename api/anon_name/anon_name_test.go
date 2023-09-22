package anon_name

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestBasic(t *testing.T) {
	got := For(uuid.MustParse("d0000000-0000-0000-0000-000000000001"))
	want := "Anonymous Yellow Eagle"
	require.Equal(t, want, got)

	got = For(uuid.MustParse("d0000000-0000-0000-0000-100000000000"))
	want = "Anonymous Maroon Grey Seal"
	require.Equal(t, want, got)
}
