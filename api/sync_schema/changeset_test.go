package sync_schema

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestChangesetMerge(t *testing.T) {
	got := Changeset{
		FDelete: setOf("f1", "f2"),
		FAdd:    []string{"f3"},
		FSet: map[string]*Feature{
			"f3": {
				Id:          "f3",
				Parent:      "unchanged",
				ParentState: Set,
				Idx:         "1",
				IdxState:    Set,
			},
		},
		LSet: map[string]*Layer{
			"l1": {
				Id:       "l1",
				Idx:      "1",
				IdxState: Set,
			},
		},
	}

	update := Changeset{
		FDelete: setOf("f1", "f4"),
		FAdd:    []string{"f5"},
		FSet: map[string]*Feature{
			"f5": {
				Id:          "f5",
				Parent:      "",
				ParentState: Set,
				Idx:         "2",
				IdxState:    Set,
			},
			"f3": {
				Id:       "f3",
				Idx:      "changed",
				IdxState: Set,
			},
		},
		LSet: map[string]*Layer{
			"l1": {
				Id:       "l1",
				IdxState: Unset,
			},
		},
	}

	want := Changeset{
		FDelete: setOf("f1", "f2", "f1", "f4"),
		FAdd:    []string{"f3", "f5"},
		FSet: map[string]*Feature{
			"f3": {
				Id:          "f3",
				Parent:      "unchanged",
				ParentState: Set,
				Idx:         "changed",
				IdxState:    Set,
			},
			"f5": {
				Id:          "f5",
				Parent:      "",
				ParentState: Set,
				Idx:         "2",
				IdxState:    Set,
			},
		},
		LSet: map[string]*Layer{
			"l1": {
				Id:       "l1",
				IdxState: Unset,
			},
		},
	}

	got.Merge(&update)

	require.Equal(t, want, got)
}

func setOf(keys ...string) map[string]struct{} {
	set := make(map[string]struct{})
	for _, k := range keys {
		set[k] = struct{}{}
	}
	return set
}
