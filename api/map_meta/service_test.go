package map_meta

import (
	"context"
	"fmt"
	"testing"

	"github.com/danielzfranklin/plantopo/api/logger"
	"github.com/danielzfranklin/plantopo/api/testutil"
	"github.com/danielzfranklin/plantopo/api/user"
	"github.com/danielzfranklin/plantopo/api/users"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
	"go.uber.org/zap"
)

type S struct {
	suite.Suite
	sandbox  *testutil.Pgx
	l        *zap.Logger
	ctx      context.Context
	users    users.Service
	nextUser int
}

func TestMapmeta(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration tests against postgres")
	}
	sandbox := testutil.PgxSandbox()
	defer sandbox.Close()
	l := logger.NewTestLogger(t)
	ctx := logger.WithCtx(context.Background(), l)
	suite.Run(t, &S{sandbox: sandbox, l: l, ctx: ctx})
}

type noopMailer struct{}

func (m *noopMailer) SendConfirmation(user user.User, token string) error {
	return nil
}

func (s *S) SetupTest() {
	s.sandbox.Reset()
	s.users = users.NewService(s.ctx, s.sandbox.Pg, &noopMailer{})
	s.nextUser = 0
}

func makeSubject(s *S) *impl {
	return NewService(s.ctx, s.sandbox.Pg).(*impl)
}

func makeUser(s *S) *user.User {
	user, err := s.users.Register(users.RegistraterRequest{
		Email:                fmt.Sprintf("user-%d@example.com", s.nextUser),
		FullName:             fmt.Sprintf("User %d", s.nextUser),
		Password:             "testpassword",
		PasswordConfirmation: "testpassword",
	})
	require.NoError(s.T(), err)
	s.nextUser++
	return user
}

func (s *S) TestBasic() {
	subject := makeSubject(s)
	owner := makeUser(s)

	_, err := subject.Get(s.ctx, uuid.MustParse("dddddddd-0000-0000-0000-000000000001"))
	require.ErrorIs(s.T(), err, &ErrNotFound{})

	_, err = subject.Patch(s.ctx, MetaUpdate{
		Id:   uuid.MustParse("dddddddd-0000-0000-0000-000000000001"),
		Name: "My New Map",
	})
	require.ErrorIs(s.T(), err, &ErrNotFound{})

	err = subject.Delete(s.ctx, uuid.MustParse("dddddddd-0000-0000-0000-000000000001"))
	require.ErrorIs(s.T(), err, &ErrNotFound{})

	resp, err := subject.Create(s.ctx, owner.Id)
	require.NoError(s.T(), err)
	require.NotEqual(s.T(), uuid.Nil, resp.Id)
	require.Equal(s.T(), "", resp.Name)
	createdAt := resp.CreatedAt
	id := resp.Id

	resp, err = subject.Get(s.ctx, id)
	require.NoError(s.T(), err)
	require.Equal(s.T(), id, resp.Id)
	require.Equal(s.T(), "", resp.Name)
	require.Equal(s.T(), createdAt, resp.CreatedAt)

	updateResp, err := subject.Patch(s.ctx, MetaUpdate{
		Id:   id,
		Name: "My New Map",
	})
	require.NoError(s.T(), err)
	require.Equal(s.T(), id, updateResp.Id)
	require.Equal(s.T(), "My New Map", updateResp.Name)
	require.Equal(s.T(), createdAt, resp.CreatedAt)

	getAfterUpdateResp, err := subject.Get(s.ctx, id)
	require.NoError(s.T(), err)
	require.Equal(s.T(), updateResp, getAfterUpdateResp)

	err = subject.Delete(s.ctx, id)
	require.NoError(s.T(), err)

	_, err = subject.Get(s.ctx, id)
	require.ErrorIs(s.T(), err, &ErrNotFound{})

	_, err = subject.Patch(s.ctx, MetaUpdate{
		Id:   id,
		Name: "New name",
	})
	require.ErrorIs(s.T(), err, &ErrNotFound{})

	// deletion is idempotent
	err = subject.Delete(s.ctx, id)
	require.NoError(s.T(), err)
}

func (s *S) TestList() {
	subject := makeSubject(s)
	alice := makeUser(s)
	bob := makeUser(s)

	a1, err := subject.Create(s.ctx, alice.Id)
	require.NoError(s.T(), err)

	aDeleted, err := subject.Create(s.ctx, alice.Id)
	require.NoError(s.T(), err)
	err = subject.Delete(s.ctx, aDeleted.Id)
	require.NoError(s.T(), err)

	b1, err := subject.Create(s.ctx, bob.Id)
	require.NoError(s.T(), err)

	bDeleted, err := subject.Create(s.ctx, bob.Id)
	require.NoError(s.T(), err)
	err = subject.Delete(s.ctx, bDeleted.Id)
	require.NoError(s.T(), err)

	s.users.Invite(s.ctx, users.InviteRequest{
		MapId: b1.Id,
		Email: alice.Email,
		Role:  "editor",
	})

	owned, err := subject.ListOwnedBy(s.ctx, alice.Id)
	require.NoError(s.T(), err)
	require.Equal(s.T(), []Meta{a1}, owned)

	shared, err := subject.ListSharedWith(s.ctx, alice.Id)
	require.NoError(s.T(), err)
	require.Equal(s.T(), []Meta{b1}, shared)
}
