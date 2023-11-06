package stores

import (
	"testing"

	schema "github.com/danielzfranklin/plantopo/api/sync_schema"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap/zaptest"
)

var mapA = "D0000000-0000-0000-0000-00000000000a"

func TestLoadEmpty(t *testing.T) {
	_, err := New(mapA, schema.Changeset{})
	require.NoError(t, err)
}

func TestInsertUnderRoot(t *testing.T) {
	l := zaptest.NewLogger(t)
	subject, err := New(mapA, schema.Changeset{})
	require.NoError(t, err)

	wantSnapshot := schema.Changeset{
		FAdd: []string{"f1"},
		FSet: map[string]schema.Feature{
			"f1": {
				Id:          "f1",
				ParentState: schema.Set,
				Parent:      "",
				IdxState:    schema.Set,
				Idx:         "O",
			},
		},
	}
	fixes, err := subject.Update(l, &wantSnapshot)
	require.NoError(t, err)
	require.Nil(t, fixes)
}

func TestCannotUpdateRoot(t *testing.T) {
	l := zaptest.NewLogger(t)
	subject, err := New(mapA, schema.Changeset{})
	require.NoError(t, err)

	_, err = subject.Update(l, &schema.Changeset{
		FSet: map[string]schema.Feature{
			"": {
				Id:          "",
				ParentState: schema.Set,
				Parent:      "",
				IdxState:    schema.Set,
				Idx:         "O",
			},
		},
	})
	require.Error(t, err)

	_, err = subject.Update(l, &schema.Changeset{
		FSet: map[string]schema.Feature{
			"": {
				Id:        "",
				NameState: schema.Set,
				Name:      "only changed name",
			},
		},
	})
	require.Error(t, err)
}

func TestStoreBasic(t *testing.T) {
	l := zaptest.NewLogger(t)

	subject, err := New(mapA, schema.Changeset{})
	require.NoError(t, err)

	wantSnapshot := schema.Changeset{
		FAdd: []string{"f1"},
		FSet: map[string]schema.Feature{
			"f1": {
				Id:          "f1",
				ParentState: schema.Set,
				Parent:      "",
				IdxState:    schema.Set,
				Idx:         "O",
			},
		},
		LSet: map[string]schema.Layer{
			"l1": {
				Id:           "l1",
				IdxState:     schema.Set,
				Idx:          "O",
				OpacityState: schema.Set,
				Opacity:      0.5,
			},
		},
	}
	fixes, err := subject.Update(l, &wantSnapshot)
	require.NoError(t, err)
	require.Nil(t, fixes)

	require.Equal(t, wantSnapshot, subject.Snapshot())
}

func TestUpdateExisting(t *testing.T) {
	l := zaptest.NewLogger(t)
	subject, err := New(mapA, schema.Changeset{})
	require.NoError(t, err)

	want := schema.Changeset{
		FAdd: []string{"f1"},
		FSet: map[string]schema.Feature{
			"f1": {
				Id:          "f1",
				ParentState: schema.Set,
				Parent:      "",
				IdxState:    schema.Set,
				Idx:         "O",
			},
		},
		LSet: map[string]schema.Layer{
			"l1": {
				Id:       "l1",
				IdxState: schema.Set,
				Idx:      "O",
			},
		},
	}
	fixes, err := subject.Update(l, &want)
	require.NoError(t, err)
	require.Nil(t, fixes)
	require.Equal(t, want, subject.Snapshot())

	_, err = subject.Update(l, &schema.Changeset{
		FSet: map[string]schema.Feature{
			"f1": {
				Id:        "f1",
				NameState: schema.Set,
				Name:      "new name",
			},
		},
		LSet: map[string]schema.Layer{
			"l1": {
				Id:           "l1",
				OpacityState: schema.Set,
				Opacity:      0.5,
				IdxState:     schema.Unset,
			},
		},
	})
	require.NoError(t, err)
	require.Equal(t, schema.Changeset{
		FAdd: []string{"f1"},
		FSet: map[string]schema.Feature{
			"f1": {
				Id:          "f1",
				ParentState: schema.Set,
				Parent:      "",
				IdxState:    schema.Set,
				Idx:         "O",
				NameState:   schema.Set,
				Name:        "new name",
			},
		},
		LSet: map[string]schema.Layer{
			"l1": {
				Id:           "l1",
				OpacityState: schema.Set,
				Opacity:      0.5,
				IdxState:     schema.Unset,
			},
		},
	}, subject.Snapshot())
}

func TestSnapshotFAddOrder(t *testing.T) {
	l := zaptest.NewLogger(t)
	subject, err := New(mapA, schema.Changeset{})
	require.NoError(t, err)

	fixes, err := subject.Update(l, &schema.Changeset{
		FAdd: []string{"fb", "fa"},
		FSet: map[string]schema.Feature{
			"fb": {
				Id:          "fb",
				ParentState: schema.Set,
				Parent:      "",
				IdxState:    schema.Set,
				Idx:         "O",
			},
			"fa": {
				Id:          "fa",
				ParentState: schema.Set,
				Parent:      "fb",
				IdxState:    schema.Set,
				Idx:         "O",
			},
		},
	})
	require.NoError(t, err)
	require.Nil(t, fixes)

	want := []string{"fb", "fa"} // parent must come before child
	for i := 0; i < 10; i++ {
		got := subject.Snapshot().FAdd
		require.Equal(t, want, got)
	}
}

func TestBasicUpdateDeterministicAndIdempotent(t *testing.T) {
	l := zaptest.NewLogger(t)

	initial := schema.Changeset{
		FAdd: []string{"f1", "f2", "f3", "f4", "f5"},
		FSet: map[string]schema.Feature{
			"f1": {
				Id:          "f1",
				ParentState: schema.Set,
				Parent:      "",
				IdxState:    schema.Set,
				Idx:         "O",
			},
			"f2": {
				Id:          "f2",
				ParentState: schema.Set,
				Parent:      "f1",
				IdxState:    schema.Set,
				Idx:         "O",
			},
			"f3": {
				Id:          "f3",
				ParentState: schema.Set,
				Parent:      "",
				IdxState:    schema.Set,
				Idx:         "P",
			},
			"f4": {
				Id:          "f4",
				ParentState: schema.Set,
				Parent:      "f1",
				IdxState:    schema.Set,
				Idx:         "P",
			},
			"f5": {
				Id:          "f5",
				ParentState: schema.Set,
				Parent:      "f3",
				IdxState:    schema.Set,
				Idx:         "O",
			},
		},
		LSet: map[string]schema.Layer{
			"l1": {
				Id:           "l1",
				IdxState:     schema.Set,
				Idx:          "O",
				OpacityState: schema.Set,
				Opacity:      0.5,
			},
		},
	}

	change := schema.Changeset{
		FDelete: setOf("f3"),
		FSet: map[string]schema.Feature{
			"f4": {
				Id:          "f4",
				ParentState: schema.Set,
				Parent:      "f1",
				IdxState:    schema.Set,
				Idx:         "O", // collides
			},
		},
		LSet: map[string]schema.Layer{
			"l1": {
				Id:           "l1",
				IdxState:     schema.Set,
				Idx:          "P", // doesn't collide
				OpacityState: schema.Set,
				Opacity:      1,
			},
		},
	}

	wantFixes1 := schema.Changeset{
		FDelete: setOf("f5"),
		FSet: map[string]schema.Feature{
			"f4": {
				Id:          "f4",
				ParentState: schema.Set,
				Parent:      "f1",
				IdxState:    schema.Set,
				Idx:         "g)",
			},
		},
	}

	wantFixes2 := schema.Changeset{
		// Missing deletes depends on server state, so it changes
		FSet: map[string]schema.Feature{
			"f4": {
				Id:          "f4",
				ParentState: schema.Set,
				Parent:      "f1",
				IdxState:    schema.Set,
				Idx:         "g)",
			},
		},
	}

	var prevSnapshotGot *schema.Changeset
	for i := 0; i < 10; i++ {
		subject, err := New(mapA, schema.Changeset{})
		require.NoError(t, err)

		fixes, err := subject.Update(l, &initial)
		require.NoError(t, err)
		require.Nil(t, fixes)

		fixes, err = subject.Update(l, &change)
		require.NoError(t, err)
		require.NotNil(t, fixes)
		require.Equal(t, &wantFixes1, fixes)
		gotSnapshot := subject.Snapshot()
		if prevSnapshotGot != nil {
			require.Equal(t, *prevSnapshotGot, gotSnapshot)
		}
		prevSnapshotGot = &gotSnapshot

		fixes, err = subject.Update(l, &change)
		require.NoError(t, err)
		require.NotNil(t, fixes)
		require.Equal(t, &wantFixes2, fixes)
		gotSnapshot = subject.Snapshot()
		require.Equal(t, *prevSnapshotGot, gotSnapshot)
		prevSnapshotGot = &gotSnapshot
	}
}

func TestCreatesFTree(t *testing.T) {
	l := zaptest.NewLogger(t)
	subject, err := New(mapA, schema.Changeset{})
	require.NoError(t, err)

	fixes, err := subject.Update(l, &schema.Changeset{
		FAdd: []string{"a", "b"},
		FSet: map[string]schema.Feature{
			"a": {
				Id:          "a",
				ParentState: schema.Set,
				Parent:      "",
				IdxState:    schema.Set,
				Idx:         "O",
			},
			"b": {
				Id:          "b",
				ParentState: schema.Set,
				Parent:      "a",
				IdxState:    schema.Set,
				Idx:         "O",
			},
		},
	})
	require.NoError(t, err)
	require.Nil(t, fixes)

	require.Equal(t, "", subject.ftree.id)
	require.Equal(t, 1, len(subject.ftree.children))
	fa := subject.ftree.children["O"]
	require.Equal(t, "a", fa.id)
	require.Equal(t, 1, len(fa.children))
	fb := fa.children["O"]
	require.Equal(t, "b", fb.id)
	require.Equal(t, 0, len(fb.children))

	fixes, err = subject.Update(l, &schema.Changeset{
		FAdd: []string{"c"},
		FSet: map[string]schema.Feature{
			"b": {
				Id:          "b",
				ParentState: schema.Set,
				Parent:      "",
				IdxState:    schema.Set,
				Idx:         "P",
			},
			"c": {
				Id:          "c",
				ParentState: schema.Set,
				Parent:      "a",
				IdxState:    schema.Set,
				Idx:         "P",
			},
		},
	})
	require.NoError(t, err)
	require.Nil(t, fixes)

	require.Equal(t, "", subject.ftree.id)
	require.Equal(t, 2, len(subject.ftree.children))

	fa = subject.ftree.children["O"]
	require.Equal(t, "a", fa.id)
	require.Equal(t, 1, len(fa.children))

	fb = subject.ftree.children["P"]
	require.Equal(t, "b", fb.id)
	require.Equal(t, 0, len(fb.children))

	fc := fa.children["P"]
	require.Equal(t, "c", fc.id)
	require.Equal(t, 0, len(fc.children))

}

func TestLayerIdxCollision(t *testing.T) {
	l := zaptest.NewLogger(t)
	subject, err := New(mapA, schema.Changeset{})
	require.NoError(t, err)

	fixes, err := subject.Update(l, &schema.Changeset{
		LSet: map[string]schema.Layer{
			"l1": {
				Id:       "l1",
				IdxState: schema.Set,
				Idx:      "O",
			},
		},
	})
	require.NoError(t, err)
	require.Nil(t, fixes)

	fixes, err = subject.Update(l, &schema.Changeset{
		LSet: map[string]schema.Layer{
			"l2": {
				Id:       "l2",
				IdxState: schema.Set,
				Idx:      "O",
			},
		},
	})
	require.NoError(t, err)
	require.NotNil(t, fixes)
	require.Equal(t, &schema.Changeset{
		LSet: map[string]schema.Layer{
			"l2": {
				Id:       "l2",
				IdxState: schema.Set,
				Idx:      "g)",
			},
		},
	}, fixes)
}

func TestFeatureIdxCollision(t *testing.T) {
	l := zaptest.NewLogger(t)
	subject, err := New(mapA, schema.Changeset{})
	require.NoError(t, err)

	fixes, err := subject.Update(l, &schema.Changeset{
		FAdd: []string{"f1"},
		FSet: map[string]schema.Feature{
			"f1": {
				Id:          "f1",
				ParentState: schema.Set,
				Parent:      "",
				IdxState:    schema.Set,
				Idx:         "O",
			},
		},
	})
	require.NoError(t, err)
	require.Nil(t, fixes)

	fixes, err = subject.Update(l, &schema.Changeset{
		FAdd: []string{"f2"},
		FSet: map[string]schema.Feature{
			"f2": {
				Id:          "f2",
				ParentState: schema.Set,
				Parent:      "",
				IdxState:    schema.Set,
				Idx:         "O",
			},
		},
	})
	require.NoError(t, err)
	require.NotNil(t, fixes)
	require.Equal(t, &schema.Changeset{
		FSet: map[string]schema.Feature{
			"f2": {
				Id:          "f2",
				ParentState: schema.Set,
				Parent:      "",
				IdxState:    schema.Set,
				Idx:         "g)",
			},
		},
	}, fixes)
}

func TestFeatureWouldCycle(t *testing.T) {
	l := zaptest.NewLogger(t)
	subject, err := New(mapA, schema.Changeset{})
	require.NoError(t, err)

	fixes, err := subject.Update(l, &schema.Changeset{
		FAdd: []string{"parent", "child"},
		FSet: map[string]schema.Feature{
			"parent": {
				Id:          "parent",
				ParentState: schema.Set,
				Parent:      "",
				IdxState:    schema.Set,
				Idx:         "O",
			},
			"child": {
				Id:          "child",
				ParentState: schema.Set,
				Parent:      "parent",
				IdxState:    schema.Set,
				Idx:         "O",
			},
		},
	})
	require.NoError(t, err)
	require.Nil(t, fixes)

	fixes, err = subject.Update(l, &schema.Changeset{
		FSet: map[string]schema.Feature{
			"parent": {
				Id:          "parent",
				ParentState: schema.Set,
				Parent:      "child",
			},
		},
	})
	require.NoError(t, err)
	require.NotNil(t, fixes)
	require.Equal(t, &schema.Changeset{
		FSet: map[string]schema.Feature{
			"parent": {
				Id:          "parent",
				ParentState: schema.Set,
				Parent:      "",
				IdxState:    schema.Set,
				Idx:         "O)",
			},
		},
	}, fixes)
}

func TestRecursiveDeletion(t *testing.T) {
	l := zaptest.NewLogger(t)
	subject, err := New(mapA, schema.Changeset{})
	require.NoError(t, err)

	fixes, err := subject.Update(l, &schema.Changeset{
		FAdd: []string{"parent", "child1", "child2", "child1child"},
		FSet: map[string]schema.Feature{
			"parent": {
				Id:          "parent",
				ParentState: schema.Set,
				Parent:      "",
				IdxState:    schema.Set,
				Idx:         "O",
			},
			"child1": {
				Id:          "child1",
				ParentState: schema.Set,
				Parent:      "parent",
				IdxState:    schema.Set,
				Idx:         "O",
			},
			"child2": {
				Id:          "child2",
				ParentState: schema.Set,
				Parent:      "parent",
				IdxState:    schema.Set,
				Idx:         "P",
			},
			"child1child": {
				Id:          "child1child",
				ParentState: schema.Set,
				Parent:      "child1",
				IdxState:    schema.Set,
				Idx:         "O",
			},
		},
	})
	require.NoError(t, err)
	require.Nil(t, fixes)

	fixes, err = subject.Update(l, &schema.Changeset{
		FDelete: setOf("parent", "child1", "child2"),
	})
	require.NoError(t, err)
	require.Equal(t, &schema.Changeset{
		FDelete: setOf("child1child"),
	}, fixes)
}

func TestCreateDup(t *testing.T) {
	l := zaptest.NewLogger(t)
	subject, err := New(mapA, schema.Changeset{})
	require.NoError(t, err)

	change := &schema.Changeset{
		FAdd: []string{"f1"},
		FSet: map[string]schema.Feature{
			"f1": {
				Id:          "f1",
				ParentState: schema.Set,
				Parent:      "",
				IdxState:    schema.Set,
				Idx:         "O",
				NameState:   schema.Set,
				Name:        "f1",
			},
		},
	}

	fixes, err := subject.Update(l, change)
	require.NoError(t, err)
	require.Nil(t, fixes)

	fixes, err = subject.Update(l, change)
	require.NoError(t, err)
	require.Nil(t, fixes)
}

func setOf(keys ...string) map[string]struct{} {
	set := make(map[string]struct{})
	for _, k := range keys {
		set[k] = struct{}{}
	}
	return set
}
