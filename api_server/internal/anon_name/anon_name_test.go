package anon_name

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBasic(t *testing.T) {
	got := For("d0000000-0000-0000-0000-000000000001")
	want := "Anonymous Lavender Akbash"
	require.Equal(t, want, got)

	got = For("d0000000-0000-0000-0000-100000000000")
	want = "Anonymous Magenta Bedlington Terrier"
	require.Equal(t, want, got)
}
