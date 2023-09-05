package store

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	schema "github.com/danielzfranklin/plantopo/sync_schema"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

var mapA = uuid.MustParse("D0000000-0000-0000-0000-00000000000a")

type mockDb struct {
	value []byte
	err   error
}

func (m *mockDb) GetMapSnapshot(ctx context.Context, mapId uuid.UUID) ([]byte, error) {
	if m.err != nil {
		return nil, m.err
	} else {
		return m.value, nil
	}
}

func (m *mockDb) SetMapSnapshot(ctx context.Context, mapId uuid.UUID, value []byte) error {
	m.value = value
	return m.err
}

func TestLoadEmpty(t *testing.T) {
	_, err := Load(context.Background(), &mockDb{}, mapA)
	require.NoError(t, err)
}

func TestInsertUnderRoot(t *testing.T) {
	subject, err := Load(context.Background(), &mockDb{}, mapA)
	require.NoError(t, err)

	wantSnapshot := schema.Changeset{
		FAdd: setOf("f1"),
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
	fixes, err := subject.Update(&wantSnapshot)
	require.NoError(t, err)
	require.Nil(t, fixes)
}

func TestCannotUpdateRoot(t *testing.T) {
	subject, err := Load(context.Background(), &mockDb{}, mapA)
	require.NoError(t, err)

	_, err = subject.Update(&schema.Changeset{
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

	_, err = subject.Update(&schema.Changeset{
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
	ctx := context.Background()
	mockDb := &mockDb{}

	subject, err := Load(ctx, mockDb, mapA)
	require.NoError(t, err)

	wantSnapshot := schema.Changeset{
		FDelete: setOf(),
		FAdd:    setOf("f1"),
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
	fixes, err := subject.Update(&wantSnapshot)
	require.NoError(t, err)
	require.Nil(t, fixes)

	require.Equal(t, wantSnapshot, subject.ToSnapshot())

	err = subject.Save(ctx)
	require.NoError(t, err)
	saved, err := unmarshalSnapshot(mockDb.value)
	require.NoError(t, err)
	require.Equal(t, wantSnapshot, saved)
}

func TestUpdateExisting(t *testing.T) {
	ctx := context.Background()
	mockDb := &mockDb{}

	subject, err := Load(ctx, mockDb, mapA)
	require.NoError(t, err)

	want := schema.Changeset{
		FDelete: setOf(),
		FAdd:    setOf("f1"),
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
	fixes, err := subject.Update(&want)
	require.NoError(t, err)
	require.Nil(t, fixes)
	require.Equal(t, want, subject.ToSnapshot())

	subject.Update(&schema.Changeset{
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
	require.Equal(t, schema.Changeset{
		FDelete: setOf(),
		FAdd:    setOf("f1"),
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
	}, subject.ToSnapshot())
}

func TestRecursiveDeletion(t *testing.T) {
	panic("TODO")
}

func TestCompression(t *testing.T) {
	snapshot := schema.Changeset{
		FDelete: setOf(),
		FAdd:    setOf(),
		FSet:    make(map[string]schema.Feature),
		LSet:    make(map[string]schema.Layer),
	}
	prevIdx := ""
	for i := 0; i < 100; i++ {
		id := fmt.Sprintf("f%d", i)
		idx, err := schema.IdxBetween(prevIdx, "O")
		require.NoError(t, err)
		snapshot.FAdd[id] = struct{}{}
		snapshot.FSet[id] = schema.Feature{
			Id:          id,
			ParentState: schema.Set,
			Parent:      "",
			IdxState:    schema.Set,
			Idx:         idx,
			NameState:   schema.Set,
			Name:        fmt.Sprintf("My Feature #%d", i),
		}
		prevIdx = idx
	}

	encoded, err := marshalSnapshot(snapshot)
	require.NoError(t, err)
	decoded, err := unmarshalSnapshot(encoded)
	require.NoError(t, err)
	require.Equal(t, snapshot, decoded)

	uncompressed, err := json.Marshal(snapshot)
	require.NoError(t, err)

	require.Less(t, len(encoded), len(uncompressed)/2)
}

func setOf(keys ...string) map[string]struct{} {
	set := make(map[string]struct{})
	for _, k := range keys {
		set[k] = struct{}{}
	}
	return set
}
