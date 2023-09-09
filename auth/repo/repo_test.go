package repo

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/danielzfranklin/plantopo/auth"
	"github.com/danielzfranklin/plantopo/db"
	"github.com/danielzfranklin/plantopo/logger"
	"github.com/danielzfranklin/plantopo/testutil"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
	"go.uber.org/zap"
	"go.uber.org/zap/zaptest"
)

type S struct {
	suite.Suite
	sandbox   *testutil.PgxSConn
	pg        *db.Pg
	ctx       context.Context
	l         *zap.Logger
	nextEmail int
}

type mockMailer struct {
	confirm func(user auth.User, token string) error
}

func (m *mockMailer) SendConfirmationEmail(user auth.User, token string) error {
	if m.confirm != nil {
		return m.confirm(user, token)
	} else {
		return nil
	}
}

var validName = "Test User"
var validPassword = "testpassword"

func TestRepo(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration tests against postgres")
	}
	sandbox := testutil.PgxSandbox()
	defer sandbox.Close()
	l := zaptest.NewLogger(t)
	ctx := logger.WithCtx(context.Background(), l)
	suite.Run(t, &S{sandbox: sandbox, pg: sandbox.Pg, l: l, ctx: ctx})
}

func (s *S) SetupTest() {
	s.nextEmail = 0
	s.sandbox.Reset()
}

func (s *S) makeSubject() (*Repo, func()) {
	var wg sync.WaitGroup
	ctx, cancel := context.WithCancel(s.ctx)
	cleanup := func() {
		cancel()
		wg.Wait()
	}
	return New(ctx, &wg, s.pg, &mockMailer{}), cleanup
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
	var regErr *auth.ErrRegistrationIssue
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
	var wg sync.WaitGroup
	ctx, cancel := context.WithCancel(s.ctx)
	defer func() {
		cancel()
		wg.Wait()
	}()
	confirms := make(chan auth.User, 1)
	mailer := &mockMailer{confirm: func(user auth.User, token string) error {
		confirms <- user
		return nil
	}}
	subject := New(ctx, &wg, s.pg, mailer)

	user, err := subject.Register(s.validReq())
	require.NoError(s.T(), err)
	fmt.Printf("user: %+v\n", user)

	confirm := <-confirms
	require.Equal(s.T(), user.Id, confirm.Id)
}

func (s *S) TestConfirmationMailerFails() {
	var wg sync.WaitGroup
	ctx, cancel := context.WithCancel(s.ctx)
	defer func() {
		cancel()
		wg.Wait()
	}()
	mails := make(chan auth.User, 1)
	mailer := &mockMailer{confirm: func(user auth.User, token string) error {
		mails <- user
		return fmt.Errorf("mock mailer error")
	}}
	subject := New(ctx, &wg, s.pg, mailer)

	user, err := subject.Register(s.validReq())
	require.NoError(s.T(), err)

	mailedUser := <-mails
	require.Equal(s.T(), user.Id, mailedUser.Id)
}

func (s *S) TestConfirmExpired() {
	var wg sync.WaitGroup
	ctx, cancel := context.WithCancel(s.ctx)
	defer func() {
		cancel()
		wg.Wait()
	}()
	tokens := make(chan string, 1)
	mailer := &mockMailer{confirm: func(user auth.User, token string) error {
		tokens <- token
		return fmt.Errorf("mock mailer error")
	}}
	subject := New(ctx, &wg, s.pg, mailer)
	subject.tokenExpiry = time.Nanosecond

	_, err := subject.Register(s.validReq())
	require.NoError(s.T(), err)

	token := <-tokens
	_, err = subject.Confirm(token)
	require.ErrorIs(s.T(), err, &ErrTokenExpired{})
}

func (s *S) TestConfirm() {
	var wg sync.WaitGroup
	ctx, cancel := context.WithCancel(s.ctx)
	defer func() {
		cancel()
		wg.Wait()
	}()
	tokens := make(chan string, 1)
	mailer := &mockMailer{confirm: func(user auth.User, token string) error {
		tokens <- token
		return fmt.Errorf("mock mailer error")
	}}
	subject := New(ctx, &wg, s.pg, mailer)

	user, err := subject.Register(s.validReq())
	require.NoError(s.T(), err)

	token := <-tokens
	confirmed, err := subject.Confirm(token)
	require.NoError(s.T(), err)
	require.Equal(s.T(), user.Id, confirmed)
}

func (s *S) TestCheckLoginNonexistantEmail() {
	subject, cleanup := s.makeSubject()
	defer cleanup()

	_, err := subject.CheckLogin(s.ctx, auth.LoginRequest{
		Email:    "nonexistant@example.com",
		Password: validPassword,
	})
	var loginErr *auth.ErrLoginIssue
	require.ErrorAs(s.T(), err, &loginErr)
	require.Equal(s.T(), "not found", loginErr.Email)
}

func (s *S) TestCheckLoginWrongPassword() {
	subject, cleanup := s.makeSubject()
	defer cleanup()
	reg := s.validReq()

	_, err := subject.Register(reg)
	require.NoError(s.T(), err)

	_, err = subject.CheckLogin(s.ctx, auth.LoginRequest{
		Email:    reg.Email,
		Password: "wrong password",
	})
	var loginErr *auth.ErrLoginIssue
	require.ErrorAs(s.T(), err, &loginErr)
	require.Equal(s.T(), "is incorrect", loginErr.Password)
}

func (s *S) TestCheckLogin() {
	subject, cleanup := s.makeSubject()
	defer cleanup()
	reg := s.validReq()

	user, err := subject.Register(reg)
	require.NoError(s.T(), err)

	got, err := subject.CheckLogin(s.ctx, auth.LoginRequest{
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

func (s *S) validReq() auth.RegistrationRequest {
	return auth.RegistrationRequest{
		Email:                s.validEmail(),
		FullName:             validName,
		Password:             validPassword,
		PasswordConfirmation: validPassword,
	}
}
