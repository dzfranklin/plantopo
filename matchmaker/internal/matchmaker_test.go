package internal

import (
	"context"
	"fmt"
	"math/rand"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMatchmaker(t *testing.T) {
	subject := NewMatchmaker()
	subject.rng = rand.New(rand.NewSource(0xdeadbeef))
	bg := context.Background()

	// test register close for nonexistent backend
	subject.RegisterClose("nonexistent", "map1")

	backends := make([]Backend, 0)
	for b := 0; b < 3; b++ {
		backends = append(backends, &mockBackend{id: fmt.Sprintf("backend%d", b)})
	}
	subject.AddBackends(backends)

	map1got1, err := subject.SetupConnection(bg, "map1")
	require.NoError(t, err)

	var map2Id string
	var map2Accept Connection
	for i := 2; ; i++ {
		map2Id = fmt.Sprintf("map%d", i)
		map2Accept, err = subject.SetupConnection(bg, map2Id)
		require.NoError(t, err)
		if map2Accept.Backend != map1got1.Backend {
			break
		}
	}

	map1got2, err := subject.SetupConnection(bg, "map1")
	require.NoError(t, err)
	require.Equal(t, map1got1.Backend, map1got2.Backend)

	subject.RegisterClose(map1got1.Backend, "map1")
	_, err = subject.SetupConnection(bg, "map1")
	require.NoError(t, err)

	subject.RemoveBackends([]string{map2Accept.Backend})
	got, err := subject.SetupConnection(bg, map2Id)
	require.NoError(t, err)
	require.NotEqual(t, map2Accept.Backend, got.Backend)

	for b := len(backends); b < 10; b++ {
		backends = append(backends, &mockBackend{id: fmt.Sprintf("backend%d", b)})
	}
	subject.AddBackends(backends) // duplication is intentional

	for rep := 0; rep < 10; rep++ {
		for i := 0; i < 100; i++ {
			_, err := subject.SetupConnection(bg, fmt.Sprintf("map%d", i))
			require.NoError(t, err)
		}
	}
}

type mockBackend struct {
	id string
}

func (m *mockBackend) Id() string {
	return m.id
}

func (m *mockBackend) SetupConnection(_ context.Context, _ string, _ string) error {
	return nil
}
