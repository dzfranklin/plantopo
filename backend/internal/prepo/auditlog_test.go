package prepo

import (
	"github.com/dzfranklin/plantopo/backend/internal/ptest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestAuditLog(t *testing.T) {
	t.Parallel()
	env := ptest.NewTestEnv(t)

	t.Run("list all", func(t *testing.T) {
		env.Reset()
		subject := newAuditLog(env.Env)

		entries, _, err := subject.ListForwards(nil, nil, nil, nil)
		require.NoError(t, err)
		assert.Empty(t, entries)

		subject.Push("subject", "object", "action", nil)

		entries, _, err = subject.ListForwards(nil, nil, nil, nil)
		require.NoError(t, err)
		assert.Len(t, entries, 1)
	})

	t.Run("has correct fields", func(t *testing.T) {
		env.Reset()
		subject := newAuditLog(env.Env)

		subject.Push("subject", "object", "action", map[string]any{"foo": 42.0})

		entries, _, err := subject.ListForwards(nil, nil, nil, nil)
		require.NoError(t, err)
		assert.Len(t, entries, 1)
		entry := entries[0]

		assert.Equal(t, "subject", entry.Subject)
		assert.Equal(t, "object", entry.Object)
		assert.Equal(t, "action", entry.Action)
		assert.Equal(t, map[string]any{"foo": 42.0}, entry.Payload)
	})

	t.Run("list filtered", func(t *testing.T) {
		env.Reset()
		subject := newAuditLog(env.Env)

		var (
			subjectMatch = "subject_match"
			objectMatch  = "object_match"
			actionMatch  = "action_match"
		)

		subject.Push("subject_nomatch", "object_nomatch", "action_nomatch", nil)
		subject.Push(subjectMatch, objectMatch, actionMatch, nil)

		bySubject, _, err := subject.ListForwards(&subjectMatch, nil, nil, nil)
		require.NoError(t, err)
		assert.Len(t, bySubject, 1)

		byObject, _, err := subject.ListForwards(nil, &objectMatch, nil, nil)
		require.NoError(t, err)
		assert.Len(t, byObject, 1)

		byAction, _, err := subject.ListForwards(nil, nil, &actionMatch, nil)
		require.NoError(t, err)
		assert.Len(t, byAction, 1)
	})

	t.Run("allows duplicates", func(t *testing.T) {
		env.Reset()
		subject := newAuditLog(env.Env)

		subject.Push("x", "x", "x", nil)
		subject.Push("x", "x", "x", nil)
	})

	t.Run("lists most recent first", func(t *testing.T) {
		env.Reset()
		subject := newAuditLog(env.Env)

		subject.Push("x", "0", "x", nil)
		subject.Push("x", "1", "x", nil)
		subject.Push("x", "2", "x", nil)

		list, _, err := subject.ListForwards(nil, nil, nil, nil)
		require.NoError(t, err)
		var order []string
		for _, entry := range list {
			order = append(order, entry.Object)
		}

		require.Equal(t, []string{"2", "1", "0"}, order)
	})

	t.Run("paginates", func(t *testing.T) {
		env.Reset()
		subject := newAuditLog(env.Env)
		count := 1000

		for i := 0; i < count; i++ {
			subject.Push("s", "o", "a", nil)
		}

		page, cursor, err := subject.ListForwards(nil, nil, nil, nil)
		require.NoError(t, err)
		require.Less(t, len(page), count)

		_, _, err = subject.ListForwards(nil, nil, nil, &cursor)
		require.NoError(t, err)
	})

	t.Run("Cursoring forwards", func(t *testing.T) {
		env.Reset()
		subject := newAuditLog(env.Env)

		mustUpToNow := func() string {
			mark, err := subject.UpToNow()
			require.NoError(t, err)
			return mark
		}
		mustListSize := func(cursor *string) int {
			list, _, err := subject.ListForwards(nil, nil, nil, cursor)
			require.NoError(t, err)
			return len(list)
		}
		doPush := func() {
			subject.Push("", "", "", nil)
		}

		assert.Equal(t, 0, mustListSize(nil))

		origin := mustUpToNow()
		assert.Equal(t, 0, mustListSize(&origin))

		doPush()
		assert.Equal(t, 1, mustListSize(&origin))

		after1 := mustUpToNow()
		assert.Equal(t, 0, mustListSize(&after1))

		doPush()
		assert.Equal(t, 2, mustListSize(&origin))
		assert.Equal(t, 1, mustListSize(&after1))
	})

	t.Run("Cursoring backwards", func(t *testing.T) {
		env.Reset()
		subject := newAuditLog(env.Env)

		mustUpToNow := func() string {
			mark, err := subject.UpToNow()
			require.NoError(t, err)
			return mark
		}
		mustListSize := func(cursor *string) int {
			list, _, err := subject.ListBackwards(nil, nil, nil, cursor)
			require.NoError(t, err)
			return len(list)
		}
		doPush := func() {
			subject.Push("", "", "", nil)
		}

		assert.Equal(t, 0, mustListSize(nil))

		start := mustUpToNow()
		assert.Equal(t, 0, mustListSize(&start))
		doPush()
		assert.Equal(t, 0, mustListSize(&start))
	})
}
