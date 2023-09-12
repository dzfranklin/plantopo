package users

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/danielzfranklin/plantopo/api/db"
	"github.com/danielzfranklin/plantopo/api/logger"
	"github.com/danielzfranklin/plantopo/api/testutil"
	"github.com/danielzfranklin/plantopo/api/user"
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
	confirm func(user user.User, token string) error
}

func (m *mockMailer) SendConfirmation(user user.User, token string) error {
	if m.confirm != nil {
		return m.confirm(user, token)
	} else {
		return nil
	}
}

var validName = "Test User"
var validPassword = "testpassword"

func TestUsers(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration tests against postgres")
	}
	sandbox := testutil.PgxSandbox()
	defer sandbox.Close()
	l := logger.NewTestLogger(t)
	ctx := logger.WithCtx(context.Background(), l)
	suite.Run(t, &S{sandbox: sandbox, pg: sandbox.Pg, l: l, ctx: ctx})
}

func (s *S) SetupTest() {
	s.nextEmail = 0
	s.sandbox.Reset()
}

type noopSender struct{}

func (s *noopSender) SendConfirmation(user user.User, token string) error {
	return nil
}

func (s *S) makeSubject() (*impl, func()) {
	ctx, cancel := context.WithCancel(s.ctx)
	cleanup := func() {
		fmt.Println("starting subject cleanup")
		cancel()
	}
	subject := NewService(ctx, s.pg, &noopSender{})
	return subject.(*impl), cleanup
}

func (s *S) TestGetNonexistant() {
	subject, cleanup := s.makeSubject()
	defer cleanup()

	got, err := subject.Get(s.ctx, uuid.New())
	require.ErrorIs(s.T(), err, &ErrNotFound{})
	require.Nil(s.T(), got)
}

func (s *S) TestRegisterTaken() {
	subject, cleanup := s.makeSubject()
	defer cleanup()
	reg := s.validReq()

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

	user, err := subject.Register(s.validReq())
	require.NoError(s.T(), err)
	require.False(s.T(), user.ConfirmedAt.Valid)
}

func (s *S) TestMailsConfirmation() {
	ctx, cancel := context.WithCancel(s.ctx)
	defer func() {
		cancel()
	}()
	confirms := make(chan user.User, 1)
	mailer := &mockMailer{confirm: func(user user.User, token string) error {
		confirms <- user
		return nil
	}}
	subject := NewService(ctx, s.pg, mailer)

	user, err := subject.Register(s.validReq())
	require.NoError(s.T(), err)
	fmt.Printf("user: %+v\n", user)

	confirm := <-confirms
	require.Equal(s.T(), user.Id, confirm.Id)
}

func (s *S) TestConfirmExpired() {
	ctx, cancel := context.WithCancel(s.ctx)
	defer func() {
		cancel()
	}()
	tokens := make(chan string, 1)
	mailer := &mockMailer{confirm: func(user user.User, token string) error {
		tokens <- token
		return nil
	}}
	subject := NewService(ctx, s.pg, mailer)
	subject.(*impl).tokenExpiry = time.Nanosecond

	_, err := subject.Register(s.validReq())
	require.NoError(s.T(), err)

	token := <-tokens
	_, err = subject.Confirm(token)
	require.ErrorIs(s.T(), err, &ErrTokenExpired{})
}

func (s *S) TestConfirm() {
	ctx, cancel := context.WithCancel(s.ctx)
	defer func() {
		cancel()
	}()
	tokens := make(chan string, 1)
	mailer := &mockMailer{confirm: func(user user.User, token string) error {
		tokens <- token
		return nil
	}}
	subject := NewService(ctx, s.pg, mailer)

	user, err := subject.Register(s.validReq())
	require.NoError(s.T(), err)

	token := <-tokens
	confirmed, err := subject.Confirm(token)
	require.NoError(s.T(), err)
	require.Equal(s.T(), user.Id, confirmed)
}

func (s *S) TestConfirmAlreadyUsed() {
	ctx, cancel := context.WithCancel(s.ctx)
	defer func() {
		cancel()
	}()
	tokens := make(chan string, 1)
	mailer := &mockMailer{confirm: func(user user.User, token string) error {
		tokens <- token
		return nil
	}}
	subject := NewService(ctx, s.pg, mailer)

	user, err := subject.Register(s.validReq())
	require.NoError(s.T(), err)
	token := <-tokens

	confirm1, err := subject.Confirm(token)
	require.NoError(s.T(), err)
	require.Equal(s.T(), user.Id, confirm1)

	confirm2, err := subject.Confirm(token)
	require.NoError(s.T(), err)
	require.Equal(s.T(), user.Id, confirm2)
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
	reg := s.validReq()

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
	reg := s.validReq()

	user, err := subject.Register(reg)
	require.NoError(s.T(), err)

	got, err := subject.CheckLogin(s.ctx, LoginRequest{
		Email:    reg.Email,
		Password: reg.Password,
	})
	require.NoError(s.T(), err)
	require.Equal(s.T(), user.Id, got.Id)
}

func (s *S) validEmail() string {
	email := fmt.Sprintf("test%d@example.com", s.nextEmail)
	s.nextEmail++
	return email
}

func (s *S) validReq() RegistraterRequest {
	return RegistraterRequest{
		Email:                s.validEmail(),
		FullName:             validName,
		Password:             validPassword,
		PasswordConfirmation: validPassword,
	}
}
