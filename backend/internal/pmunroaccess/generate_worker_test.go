package pmunroaccess

import (
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/ptest"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/rivertype"
	"github.com/stretchr/testify/require"
	"testing"
	"time"
)

func TestSmoke_Work(t *testing.T) {
	t.Skip()

	env := ptest.NewTestEnv(t)
	w := GenerateWorker{
		l:       env.Logger,
		objects: env.Objects,
		rdb:     env.RDB,
	}
	err := w.Work(context.Background(), &river.Job[GenerateArgs]{
		JobRow: &rivertype.JobRow{
			ID: 42,
		},
		Args: GenerateArgs{
			ID:   "test_id",
			Date: time.Date(2024, 07, 27, 0, 0, 0, 0, time.UTC),
			From: [2]float64{1, 2},
		},
	})
	require.NoError(t, err)
}
