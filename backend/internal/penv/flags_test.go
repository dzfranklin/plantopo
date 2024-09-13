package penv

import (
	"github.com/dzfranklin/plantopo/backend/internal/ptest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"testing"
	"time"
)

func TestFlagsRepo(t *testing.T) {
	t.Parallel()
	env := ptest.NewTestEnv(t)

	t.Run("bool set/get", func(t *testing.T) {
		env.Reset()

		subject := StartFlagRepo(env.Logger, env.DB, 15*time.Second)
		defer subject.Close()

		assert.False(t, subject.BoolFlag("key"))

		assert.NoError(t, subject.SetBoolFlag("key", true))
		assert.True(t, subject.BoolFlag("key"))

		assert.NoError(t, subject.SetBoolFlag("key", false))
		assert.False(t, subject.BoolFlag("key"))
	})

	t.Run("multiple repos", func(t *testing.T) {
		env.Reset()

		subject1 := StartFlagRepo(env.Logger, env.DB, time.Millisecond*10)
		subject2 := StartFlagRepo(env.Logger, env.DB, time.Millisecond*10)
		defer subject1.Close()
		defer subject2.Close()

		assert.False(t, subject1.BoolFlag("key"))
		assert.False(t, subject2.BoolFlag("key"))

		require.NoError(t, subject1.SetBoolFlag("key", true))

		time.Sleep(time.Millisecond * 100)

		assert.True(t, subject1.BoolFlag("key"))
		assert.True(t, subject2.BoolFlag("key"))
	})
}
