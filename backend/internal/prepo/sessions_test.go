package prepo

import (
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/ptest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"net/netip"
	"testing"
)

func TestSessions(t *testing.T) {
	t.Parallel()
	env := ptest.NewTestEnv(t)

	user := "u_248h248h248h248h248h248h24"
	user2 := "u_248h248h248h248h248h248h28"

	var al *AuditLog
	makeSubject := func(t *testing.T) *Sessions {
		t.Helper()

		al = newAuditLog(env.Env)

		users, err := newUsers(env.Env, al)
		require.NoError(t, err)

		subject := newSessions(env.Env, al, users)
		return subject
	}

	t.Run("basic", func(t *testing.T) {
		env.Reset()
		subject := makeSubject(t)

		// We create a session

		token1, err := subject.Create(SessionCreateOptions{UserID: user})
		require.NoError(t, err)

		// user has one session, user2 has none

		list, err := subject.ListSessionsByUser(user)
		require.NoError(t, err)
		assert.Len(t, list, 1)

		list, err = subject.ListSessionsByUser(user2)
		require.NoError(t, err)
		assert.Len(t, list, 0)

		// We can look up user by their session

		got, err := subject.LookupUser(token1)
		require.NoError(t, err)
		assert.Equal(t, user, got)

		// Looking up nonexistent sessions returns an error

		_, err = subject.LookupUser("not a token")
		assert.ErrorIs(t, err, ErrInvalidSessionToken)

		// After we revoke token1 it no longer works

		err = subject.Revoke(token1)
		require.NoError(t, err)

		_, err = subject.LookupUser("not a token")
		assert.ErrorIs(t, err, ErrInvalidSessionToken)
	})

	t.Run("auditlog", func(t *testing.T) {
		env.Reset()
		subject := makeSubject(t)

		beforeCreate := markAuditLog(t, al)
		token, err := subject.Create(SessionCreateOptions{
			UserID:    user,
			UserAgent: "myUserAgent",
			IPAddr:    netip.IPv4Unspecified(),
		})
		require.NoError(t, err)
		assertAudit(t, al, beforeCreate, AuditLogEntry{
			Subject: user,
			Object:  user,
			Action:  "SessionCreate",
			Payload: M{"UserAgent": "myUserAgent", "IPAddr": "0.0.0.0"},
		})

		beforeRevoke := markAuditLog(t, al)
		err = subject.Revoke(token)
		require.NoError(t, err)
		assertAudit(t, al, beforeRevoke, AuditLogEntry{
			Subject: user,
			Object:  user,
			Action:  "SessionRevoke",
		})
	})

	t.Run("cannot create session for nonexistent user", func(t *testing.T) {
		env.Reset()
		subject := makeSubject(t)

		_, err := subject.Create(SessionCreateOptions{UserID: user})
		require.NoError(t, err)

		_, err = subject.Create(SessionCreateOptions{UserID: "u_068ak35zj9ww1f0hdqmh8kkvcw"})
		require.Error(t, err)
	})

	t.Run("rejects expired sessions", func(t *testing.T) {
		env.Reset()
		subject := makeSubject(t)

		token, err := subject.Create(SessionCreateOptions{UserID: user})
		require.NoError(t, err)

		_, err = subject.LookupUser(token)
		require.NoError(t, err)

		_, err = env.DB.Exec(context.Background(),
			"UPDATE sessions SET expiry_start = now() - '1 year'::interval WHERE token = $1", token)
		require.NoError(t, err)

		_, err = subject.LookupUser(token)
		require.Error(t, err)
	})

	t.Run("refreshes old session expiry", func(t *testing.T) {
		env.Reset()
		subject := makeSubject(t)

		token, err := subject.Create(SessionCreateOptions{UserID: user})
		require.NoError(t, err)

		sessions, err := subject.ListSessionsByUser(user)
		require.NoError(t, err)
		t1 := sessions[0].ExpiryStart

		_, err = subject.LookupUser(token)
		require.NoError(t, err)
		sessions, err = subject.ListSessionsByUser(user)
		require.NoError(t, err)
		t2 := sessions[0].ExpiryStart

		_, err = env.DB.Exec(context.Background(),
			"UPDATE sessions SET expiry_start = now() - '5 days'::interval WHERE token = $1", token)
		require.NoError(t, err)

		_, err = subject.LookupUser(token)
		require.NoError(t, err)
		sessions, err = subject.ListSessionsByUser(user)
		require.NoError(t, err)
		t3 := sessions[0].ExpiryStart

		assert.Equal(t, t1, t2)
		assert.Greater(t, t3, t1)
	})
}
