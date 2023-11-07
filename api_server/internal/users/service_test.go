package users

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/danielzfranklin/plantopo/api_server/internal/loggers"
	"github.com/danielzfranklin/plantopo/api_server/internal/mailer"
	"github.com/danielzfranklin/plantopo/api_server/internal/testutil"
	"github.com/danielzfranklin/plantopo/api_server/internal/types"
	"github.com/danielzfranklin/plantopo/db"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
	"go.uber.org/zap"
)

type S struct {
	suite.Suite
	sandbox   *testutil.Pgx
	pg        *db.Pg
	ctx       context.Context
	l         *zap.Logger
	nextEmail int
}

type mockMailer struct {
	confirms map[uuid.UUID]string
	resets   map[uuid.UUID]string
}

func (m *mockMailer) SendConfirmation(user *types.User, token string) error {
	if m.confirms == nil {
		m.confirms = make(map[uuid.UUID]string)
	}
	m.confirms[user.Id] = token
	return nil
}

func (m *mockMailer) SendPasswordReset(user *types.User, token string) error {
	if m.resets == nil {
		m.resets = make(map[uuid.UUID]string)
	}
	m.resets[user.Id] = token
	return nil
}

func (m *mockMailer) SendShareNotification(_ mailer.ShareNotificationRequest) error {
	return nil
}

func (m *mockMailer) SendInvite(_ mailer.InviteRequest) error {
	return nil
}

func (m *mockMailer) CheckDeliverable(_ context.Context, _ string) (bool, error) {
	return true, nil
}

var validName = "Test User"
var validPassword = "testpassword"

func TestUsers(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration tests against postgres")
	}
	sandbox := testutil.PgxSandbox()
	defer sandbox.Close()
	l := loggers.NewTestLogger(t)
	ctx := loggers.WithCtx(context.Background(), l)
	suite.Run(t, &S{sandbox: sandbox, pg: sandbox.Pg, l: l, ctx: ctx})
}

func (s *S) SetupTest() {
	s.nextEmail = 0
	s.sandbox.Reset()
}

func (s *S) makeSubject() (*impl, func()) {
	ctx, cancel := context.WithCancel(s.ctx)
	cleanup := func() {
		cancel()
	}
	subject := NewService(ctx, s.pg, mailer.NewNoop())
	return subject.(*impl), cleanup
}

func (s *S) TestGetNonexistant() {
	subject, cleanup := s.makeSubject()
	defer cleanup()

	got, err := subject.Get(s.ctx, uuid.New())
	require.ErrorIs(s.T(), err, ErrNotFound)
	require.Nil(s.T(), got)
}

func (s *S) TestRegisterTaken() {
	subject, cleanup := s.makeSubject()
	defer cleanup()
	reg := s.validRegisterRequest()

	user, err := subject.Register(reg)
	require.NoError(s.T(), err)
	require.NotNil(s.T(), user)

	user, err = subject.Register(reg)
	var regErr *ErrRegistrationIssue
	require.ErrorAs(s.T(), err, &regErr)
	require.Equal(s.T(), "is already taken", regErr.Email)
	require.Nil(s.T(), user)
}

func (s *S) TestNewlyRegisteredUserHasNullConfirmedAt() {
	subject, cleanup := s.makeSubject()
	defer cleanup()

	user, err := subject.Register(s.validRegisterRequest())
	require.NoError(s.T(), err)
	require.False(s.T(), user.ConfirmedAt.Valid)
}

func (s *S) TestMailsConfirmation() {
	ctx, cancel := context.WithCancel(s.ctx)
	defer cancel()
	m := &mockMailer{}
	subject := NewService(ctx, s.pg, m)

	user, err := subject.Register(s.validRegisterRequest())
	require.NoError(s.T(), err)
	fmt.Printf("user: %+v\n", user)

	got := m.confirms[user.Id]
	require.NotNil(s.T(), got)
}

func (s *S) TestConfirmExpired() {
	ctx, cancel := context.WithCancel(s.ctx)
	defer cancel()
	m := &mockMailer{}
	subject := NewService(ctx, s.pg, m)
	subject.(*impl).tokenExpiry = time.Nanosecond

	user, err := subject.Register(s.validRegisterRequest())
	require.NoError(s.T(), err)

	token := m.confirms[user.Id]
	_, err = subject.Confirm(token)
	require.ErrorIs(s.T(), err, ErrTokenExpired)
}

func (s *S) TestConfirmInvalid() {
	subject, cleanup := s.makeSubject()
	defer cleanup()
	_, err := subject.Confirm("invalid token")
	require.ErrorIs(s.T(), err, ErrNotFound)
}

func (s *S) TestConfirm() {
	ctx, cancel := context.WithCancel(s.ctx)
	defer cancel()
	m := &mockMailer{}
	subject := NewService(ctx, s.pg, m)

	user, err := subject.Register(s.validRegisterRequest())
	require.NoError(s.T(), err)

	token := m.confirms[user.Id]
	confirmed, err := subject.Confirm(token)
	require.NoError(s.T(), err)
	require.Equal(s.T(), user.Id, confirmed)

	_, err = subject.Confirm(token)
	require.Error(s.T(), err)
	require.ErrorIs(s.T(), err, ErrTokenUsed)

	got, err := subject.Get(s.ctx, user.Id)
	require.NoError(s.T(), err)
	require.True(s.T(), got.ConfirmedAt.Valid)
}

func (s *S) TestRerequestConfirmation() {
	ctx, cancel := context.WithCancel(s.ctx)
	defer cancel()
	m := &mockMailer{}
	subject := NewService(ctx, s.pg, m)

	user, err := subject.Register(s.validRegisterRequest())
	require.NoError(s.T(), err)
	token1 := m.confirms[user.Id]

	err = subject.RerequestConfirmation(user.Email)
	require.NoError(s.T(), err)
	token2 := m.confirms[user.Id]

	require.NotEqual(s.T(), token1, token2)

	confirmed, err := subject.Confirm(token2)
	require.NoError(s.T(), err)
	require.Equal(s.T(), user.Id, confirmed)
}

func (s *S) TestRequestPasswordReset() {
	cases := []struct {
		email string
		err   error
	}{
		{"nonexistant@example.com", ErrNotFound},
		{s.validUnconfirmedUser().Email, nil},
		{s.validUser().Email, nil},
	}
	for _, c := range cases {
		func() {
			subject, cleanup := s.makeSubject()
			defer cleanup()

			err := subject.RequestPasswordReset(c.email)
			if c.err == nil {
				require.NoError(s.T(), err)
			} else {
				require.ErrorIs(s.T(), err, c.err)
			}
		}()
	}
}

func (s *S) TestResetPasswordExpiredToken() {
	ctx, cancel := context.WithCancel(s.ctx)
	defer cancel()
	m := &mockMailer{}
	subject := NewService(ctx, s.pg, m)
	subject.(*impl).tokenExpiry = time.Nanosecond
	user := s.validUser()

	err := subject.RequestPasswordReset(user.Email)
	require.NoError(s.T(), err)
	token := m.resets[user.Id]
	require.NotEmpty(s.T(), token)

	_, err = subject.ResetPassword(token, "new password")
	require.ErrorIs(s.T(), err, ErrTokenExpired)
}

func (s *S) TestResetPasswordInvalidToken() {
	subject, cleanup := s.makeSubject()
	defer cleanup()
	user := s.validUser()

	err := subject.RequestPasswordReset(user.Email)
	require.NoError(s.T(), err)

	_, err = subject.CheckPasswordReset(s.ctx, "invalid token")
	require.ErrorIs(s.T(), err, ErrNotFound)

	_, err = subject.ResetPassword("invalid token", "new password")
	require.ErrorIs(s.T(), err, ErrNotFound)
}

func (s *S) TestResetPassword() {
	ctx, cancel := context.WithCancel(s.ctx)
	defer cancel()
	m := &mockMailer{}
	subject := NewService(ctx, s.pg, m)
	user := s.validUser()

	err := subject.RequestPasswordReset(user.Email)
	require.NoError(s.T(), err)
	token := m.resets[user.Id]
	require.NotEmpty(s.T(), token)

	checkReply, err := subject.CheckPasswordReset(s.ctx, token)
	require.NoError(s.T(), err)
	require.Equal(s.T(), user, checkReply)

	_, err = subject.CheckLogin(s.ctx, LoginRequest{
		Email:    user.Email,
		Password: "new password",
	})
	require.Error(s.T(), err)

	_, err = subject.ResetPassword(token, "new password")
	require.NoError(s.T(), err)

	_, err = subject.CheckLogin(s.ctx, LoginRequest{
		Email:    user.Email,
		Password: "new password",
	})
	require.NoError(s.T(), err)
}

func (s *S) TestCheckLoginNonexistantEmail() {
	subject, cleanup := s.makeSubject()
	defer cleanup()

	_, err := subject.CheckLogin(s.ctx, LoginRequest{
		Email:    "nonexistant@example.com",
		Password: validPassword,
	})
	var loginErr *ErrLoginIssue
	require.ErrorAs(s.T(), err, &loginErr)
	require.Equal(s.T(), "not found", loginErr.Email)
}

func (s *S) TestCheckLoginWrongPassword() {
	subject, cleanup := s.makeSubject()
	defer cleanup()
	reg := s.validRegisterRequest()

	_, err := subject.Register(reg)
	require.NoError(s.T(), err)

	_, err = subject.CheckLogin(s.ctx, LoginRequest{
		Email:    reg.Email,
		Password: "wrong password",
	})
	var loginErr *ErrLoginIssue
	require.ErrorAs(s.T(), err, &loginErr)
	require.Equal(s.T(), "is incorrect", loginErr.Password)
}

func (s *S) TestCheckLogin() {
	subject, cleanup := s.makeSubject()
	defer cleanup()
	reg := s.validRegisterRequest()

	user, err := subject.Register(reg)
	require.NoError(s.T(), err)

	got, err := subject.CheckLogin(s.ctx, LoginRequest{
		Email:    reg.Email,
		Password: reg.Password,
	})
	require.NoError(s.T(), err)
	require.Equal(s.T(), user.Id, got.Id)
}

func (s *S) validUnregisteredEmail() string {
	email := fmt.Sprintf("test%d@example.com", s.nextEmail)
	s.nextEmail++
	return email
}

func (s *S) validRegisterRequest() RegisterRequest {
	return RegisterRequest{
		Email:    s.validUnregisteredEmail(),
		FullName: validName,
		Password: validPassword,
	}
}

func (s *S) validUnconfirmedUser() *types.User {
	subject, cleanup := s.makeSubject()
	defer cleanup()

	user, err := subject.Register(s.validRegisterRequest())
	require.NoError(s.T(), err)
	return user
}

func (s *S) validUser() *types.User {
	subject, cleanup := s.makeSubject()
	defer cleanup()

	user, err := subject.Register(s.validRegisterRequest())
	require.NoError(s.T(), err)

	err = subject.forceConfirm(user.Id)
	require.NoError(s.T(), err)

	user, err = subject.Get(s.ctx, user.Id)
	require.NoError(s.T(), err)

	return user
}
