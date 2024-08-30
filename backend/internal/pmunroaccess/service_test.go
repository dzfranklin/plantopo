package pmunroaccess

import (
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/ptest"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestStatusImmediatelyAvailable(t *testing.T) {
	t.Parallel()

	env := ptest.NewTestEnv(t)
	subject := New(env.Env)

	status, err := subject.Request(Request{})
	require.NoError(t, err)

	_, err = subject.Status(context.Background(), status.Report.ID)
	require.NoError(t, err)
}
