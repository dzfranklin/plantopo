package prepo

import (
	"github.com/dzfranklin/plantopo/backend/internal/ptest"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestNew(t *testing.T) {
	t.Parallel()
	env := ptest.NewTestEnv(t)
	_, err := New(env.Env)
	require.NoError(t, err)
}
