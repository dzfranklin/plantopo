package sync_schema

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMarshalChangesetChunkTooSmall(t *testing.T) {
	cset := Changeset{FDelete: map[string]struct{}{"foooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo": {}}}
	err := cset.MarshalJSONStream(maxContainerOverhead*2, func(bytes []byte) error {
		return nil
	})
	require.Error(t, err)
}

func TestMarshalStream(t *testing.T) {
	cset := Changeset{
		FDelete: map[string]struct{}{"01HFEX5Z4D1P7F141BCJGM4BVA": {}, "01HFEX67BXJ0C9KZKRPY2ZGSVJ": {}},
		FAdd:    []string{"01HFEX6SZMDGYZYJ990VKT0JB2"},
		FSet: map[string]*Feature{
			"01HFEX6C4T63K6XQZHTS2832XK": {
				Id:          "01HFEX6C4T63K6XQZHTS2832XK",
				ParentState: Set,
				Parent:      "01HFEX6NG5C068R528H373ZE14",
			},
			"01HFEX6SZMDGYZYJ990VKT0JB2": {
				Id:          "01HFEX6SZMDGYZYJ990VKT0JB2",
				ParentState: Set,
				Parent:      "",
			},
		},
		LSet: map[string]*Layer{
			"l1": {
				Id:       "l1",
				IdxState: Set,
				Idx:      "1",
			},
			"l2": {
				Id:       "l2",
				IdxState: Set,
				Idx:      "2",
			},
		},
	}
	got := marshalStream(t, 150, cset)
	want := []string{
		`{"lset":{"l1":{"id":"l1","idx":"1"},"l2":{"id":"l2","idx":"2"}}}`,
		`{"fadd":["01HFEX6SZMDGYZYJ990VKT0JB2"],"fset":{"01HFEX6SZMDGYZYJ990VKT0JB2":{"id":"01HFEX6SZMDGYZYJ990VKT0JB2","parent":""}}}`,
		`{"fset":{"01HFEX6C4T63K6XQZHTS2832XK":{"id":"01HFEX6C4T63K6XQZHTS2832XK","parent":"01HFEX6NG5C068R528H373ZE14"}}}`,
		`{"fdelete":["01HFEX5Z4D1P7F141BCJGM4BVA","01HFEX67BXJ0C9KZKRPY2ZGSVJ"]}`,
	}
	require.Equal(t, want, got)
}

func marshalStream(t *testing.T, maxChunk int, cset Changeset) []string {
	t.Helper()
	out := make([]string, 0)
	err := cset.MarshalJSONStream(maxChunk, func(bytes []byte) error {
		out = append(out, string(bytes))
		return nil
	})
	require.NoError(t, err)
	return out
}

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
