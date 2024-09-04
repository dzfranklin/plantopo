package prepo

import (
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/ptest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/throttled/throttled/v2"
	"strings"
	"testing"
)

func TestUsers(t *testing.T) {
	t.Parallel()
	env := ptest.NewTestEnv(t)

	userID := "u_248h248h248h248h248h248h24"

	makeSubject := func(t *testing.T) (*AuditLog, *Users) {
		t.Helper()
		al := newAuditLog(env.Env)
		subject := newUsers(env.Env, al)
		return al, subject
	}

	validRegistration := UserRegistration{
		Name:     "My Name",
		Email:    "new-user@example.com",
		Password: "01J2MTNRB9ZM7BZBXG5KQ2WQ10",
	}

	t.Run("Get", func(t *testing.T) {
		env.Reset()
		_, subject := makeSubject(t)

		_, err := subject.Get("u_068ak91kvhwkffbpmh2v4yesfg")
		require.ErrorIs(t, err, ErrNotFound)

		user, err := subject.Get(userID)
		require.NoError(t, err)
		assert.Equal(t, userID, user.ID)
		assert.Equal(t, "Test User", user.Name)
		assert.Equal(t, "test@example.com", user.Email)
		assert.Equal(t, true, user.EmailConfirmed)
	})

	t.Run("GetByEmail", func(t *testing.T) {
		env.Reset()
		_, subject := makeSubject(t)

		_, err := subject.GetByEmail("nonexistent@example.com")
		require.ErrorIs(t, err, ErrNotFound)

		user, err := subject.GetByEmail("test@example.com")
		require.NoError(t, err)
		assert.Equal(t, userID, user.ID)
		assert.Equal(t, "Test User", user.Name)
		assert.Equal(t, "test@example.com", user.Email)
		assert.Equal(t, true, user.EmailConfirmed)
	})

	t.Run("Register then CheckLogin", func(t *testing.T) {
		env.Reset()
		al, subject := makeSubject(t)

		beforeRegister := markAuditLog(t, al)
		user, err := subject.Register(UserRegistration{
			Name:     "My Name",
			Email:    "new-user@example.com",
			Password: "01J2MTNRB9ZM7BZBXG5KQ2WQ10",
		})
		require.NoError(t, err)
		assert.Equal(t, "My Name", user.Name)
		assert.Equal(t, "new-user@example.com", user.Email)
		assert.False(t, user.EmailConfirmed)
		assertAudit(t, al, beforeRegister,
			AuditLogEntry{Subject: user.ID, Object: user.ID, Action: "Register", Payload: M{"email": user.Email}})

		beforeCheckLogin := markAuditLog(t, al)
		loggedInAs, err := subject.CheckLogin(user.Email, "01J2MTNRB9ZM7BZBXG5KQ2WQ10")
		require.NoError(t, err)
		require.Equal(t, user, loggedInAs)
		assertAudit(t, al, beforeCheckLogin,
			AuditLogEntry{Subject: user.ID, Object: user.ID, Action: "Login", Payload: M{"email": user.Email}})
	})

	t.Run("Register invalid", func(t *testing.T) {
		env.Reset()
		_, subject := makeSubject(t)

		_, err := subject.Register(UserRegistration{
			Name:     "",
			Email:    "not email",
			Password: "password",
		})
		assertFieldErrors(t, err, SM{
			"name":     "is required",
			"email":    "is invalid",
			"password": "is too weak",
		})
	})

	t.Run("Register duplicate", func(t *testing.T) {
		env.Reset()
		_, subject := makeSubject(t)

		_, err := subject.Register(validRegistration)
		require.NoError(t, err)

		_, err = subject.Register(validRegistration)
		assertFieldErrors(t, err, SM{"email": "is already registered"})
	})

	t.Run("CheckLogin returns field errors", func(t *testing.T) {
		env.Reset()
		_, subject := makeSubject(t)

		_, err := subject.CheckLogin("nonexistent@example.com", "password")
		assertFieldErrors(t, err, SM{"email": "is incorrect"})

		_, err = subject.CheckLogin("test@example.com", "incorrect_password")
		assertFieldErrors(t, err, SM{"password": "is incorrect"})
	})

	t.Run("newly created user is not admin", func(t *testing.T) {
		env.Reset()
		_, subject := makeSubject(t)

		user, err := subject.Register(validRegistration)
		require.NoError(t, err)

		isAdmin, err := subject.IsAdmin(user.ID)
		require.NoError(t, err)
		require.False(t, isAdmin)
	})

	t.Run("verify email", func(t *testing.T) {
		env.Reset()
		_, subject := makeSubject(t)

		user, err := subject.Register(validRegistration)
		require.NoError(t, err)

		link, err := subject.createEmailVerificationLink(context.Background(), user)
		require.NoError(t, err)
		token := strings.TrimPrefix(link, "https://api.plantopo.com/api/v1/complete-registration?token=")

		status, err := subject.VerifyEmail(token)
		require.NoError(t, err)
		require.Equal(t, VerificationSuccess, status)
	})
}

func TestUsers_CheckLoginIsRateLimited(t *testing.T) {
	env := ptest.NewTestEnv(t)

	env.Config.Users.LoginThrottle = throttled.RateQuota{MaxRate: throttled.PerMin(1), MaxBurst: 1}

	al := newAuditLog(env.Env)
	subject := newUsers(env.Env, al)

	password := "01J2MTNRB9ZM7BZBXG5KQ2WQ10"
	user, err := subject.Register(UserRegistration{
		Name:     "My Name",
		Email:    "new-user@example.com",
		Password: password,
	})
	require.NoError(t, err)

	// Initially succeeds
	_, err = subject.CheckLogin(user.Email, password)
	require.NoError(t, err)
	_, err = subject.CheckLogin(user.Email, password)
	require.NoError(t, err)

	// But then is rate-limited
	_, err = subject.CheckLogin(user.Email, password)
	require.NotNil(t, err)
	require.ErrorContains(t, err, "rate limited")
}
