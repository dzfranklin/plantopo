package maps

import (
	"context"
	"fmt"
	"testing"

	"github.com/danielzfranklin/plantopo/api_server/internal/logger"
	"github.com/danielzfranklin/plantopo/api_server/internal/mailer"
	"github.com/danielzfranklin/plantopo/api_server/internal/testutil"
	"github.com/danielzfranklin/plantopo/api_server/internal/types"
	"github.com/danielzfranklin/plantopo/api_server/internal/users"
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

func TestMapService(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration tests against postgres")
	}
	sandbox := testutil.PgxSandbox()
	defer sandbox.Close()
	l := logger.NewTestLogger(t)
	ctx := logger.WithCtx(context.Background(), l)
	suite.Run(t, &S{sandbox: sandbox, l: l, ctx: ctx})
}

func (s *S) SetupTest() {
	s.sandbox.Reset()
	s.users = users.NewService(s.ctx, s.sandbox.Pg, mailer.NewNoop())
	s.nextUser = 0
}

func makeSubject(s *S) *impl {
	return NewService(s.l, s.sandbox.Pg, s.users, mailer.NewNoop()).(*impl)
}

func makeUser(s *S) *types.User {
	user, err := s.users.Register(users.RegisterRequest{
		Email:    fmt.Sprintf("user-%d@example.com", s.nextUser),
		FullName: fmt.Sprintf("User %d", s.nextUser),
		Password: "testpassword",
	})
	require.NoError(s.T(), err)
	s.nextUser++
	return user
}

func (s *S) TestBasic() {
	subject := makeSubject(s)
	owner := makeUser(s)

	_, err := subject.Get(s.ctx, "d1")
	require.ErrorIs(s.T(), err, ErrMapNotFound)

	_, err = subject.Put(s.ctx, MetaUpdateRequest{
		Id:   "d1",
		Name: "My New Map",
	})
	require.ErrorIs(s.T(), err, ErrMapNotFound)

	err = subject.Delete(s.ctx,
		[]string{"d1"})
	require.NoError(s.T(), err)

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

	updateResp, err := subject.Put(s.ctx, MetaUpdateRequest{
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

	err = subject.Delete(s.ctx, []string{id})
	require.NoError(s.T(), err)

	_, err = subject.Get(s.ctx, id)
	require.ErrorIs(s.T(), err, ErrMapNotFound)

	_, err = subject.Put(s.ctx, MetaUpdateRequest{
		Id:   id,
		Name: "New name",
	})
	require.ErrorIs(s.T(), err, ErrMapNotFound)

	// deletion is idempotent
	err = subject.Delete(s.ctx, []string{id})
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
	err = subject.Delete(s.ctx, []string{aDeleted.Id})
	require.NoError(s.T(), err)

	b1, err := subject.Create(s.ctx, bob.Id)
	require.NoError(s.T(), err)

	bDeleted, err := subject.Create(s.ctx, bob.Id)
	require.NoError(s.T(), err)
	err = subject.Delete(s.ctx, []string{bDeleted.Id})
	require.NoError(s.T(), err)

	err = subject.Invite(s.ctx, bob, InviteRequest{
		MapId: b1.Id,
		Email: alice.Email,
		Role:  "editor",
	})
	require.NoError(s.T(), err)

	owned, err := subject.ListOwnedBy(s.ctx, alice.Id)
	require.NoError(s.T(), err)
	require.Equal(s.T(), []types.MapMeta{a1}, owned)

	shared, err := subject.ListSharedWith(s.ctx, alice.Id)
	require.NoError(s.T(), err)
	require.Len(s.T(), shared, 1)
	require.Equal(s.T(), []types.MapMeta{b1}, shared)
}

func (s *S) TestDeleteIdempotent() {
	subject := makeSubject(s)
	alice := makeUser(s)

	err := subject.Delete(s.ctx, []string{"nonexistent"})
	require.NoError(s.T(), err)

	m1, err := subject.Create(s.ctx, alice.Id)
	require.NoError(s.T(), err)

	err = subject.Delete(s.ctx, []string{m1.Id})
	require.NoError(s.T(), err)

	err = subject.Delete(s.ctx, []string{m1.Id})
	require.NoError(s.T(), err)
}

func (s *S) TestCannotAccessDeleted() {
	// SETUP

	subject := makeSubject(s)
	alice := makeUser(s)
	bob := makeUser(s)
	john := makeUser(s)

	m1, err := subject.Create(s.ctx, alice.Id)
	require.NoError(s.T(), err)

	err = subject.Invite(s.ctx, bob, InviteRequest{
		MapId: m1.Id,
		Email: bob.Email,
		Role:  "editor",
	})
	require.NoError(s.T(), err)

	publicMap, err := subject.Create(s.ctx, john.Id)
	require.NoError(s.T(), err)

	err = subject.PutAccess(s.ctx, alice, PutAccessRequest{
		MapId:              publicMap.Id,
		GeneralAccessLevel: "public",
		GeneralAccessRole:  "editor",
	})
	require.NoError(s.T(), err)

	err = subject.Delete(s.ctx, []string{m1.Id, publicMap.Id})
	require.NoError(s.T(), err)

	// TEST

	_, err = subject.Get(s.ctx, m1.Id)
	require.ErrorIs(s.T(), err, ErrMapNotFound)

	_, err = subject.Put(s.ctx, MetaUpdateRequest{
		Id:   m1.Id,
		Name: "New name",
	})
	require.ErrorIs(s.T(), err, ErrMapNotFound)

	list, err := subject.ListOwnedBy(s.ctx, alice.Id)
	require.NoError(s.T(), err)
	require.Empty(s.T(), list)

	list, err = subject.ListSharedWith(s.ctx, bob.Id)
	require.NoError(s.T(), err)
	require.Empty(s.T(), list)

	isAuthorized := subject.IsAuthorized(s.ctx, AuthzRequest{
		UserId: alice.Id,
		MapId:  m1.Id,
	}, ActionEdit)
	require.False(s.T(), isAuthorized)

	_, err = subject.CheckOpen(s.ctx, AuthzRequest{
		UserId: bob.Id,
		MapId:  m1.Id,
	})
	require.ErrorIs(s.T(), err, ErrMapNotFound)

	_, err = subject.CheckOpen(s.ctx, AuthzRequest{
		UserId: bob.Id,
		MapId:  publicMap.Id,
	})
	require.ErrorIs(s.T(), err, ErrMapNotFound)

	_, err = subject.Access(s.ctx, m1.Id)
	require.ErrorIs(s.T(), err, ErrMapNotFound)

	err = subject.Invite(s.ctx, alice, InviteRequest{
		MapId: m1.Id,
		Email: john.Email,
		Role:  "editor",
	})
	require.ErrorIs(s.T(), err, ErrMapNotFound)
}

func (s *S) TestPutAccess() {
	subject := makeSubject(s)
	alice := makeUser(s)
	bob := makeUser(s)
	m1, err := subject.Create(s.ctx, alice.Id)
	require.NoError(s.T(), err)

	scenarios := []struct {
		req  PutAccessRequest
		want Access
	}{
		{
			PutAccessRequest{
				MapId: m1.Id,
				Owner: &alice.Id,
			},
			Access{
				MapId:              m1.Id,
				Owner:              alice,
				GeneralAccessLevel: "restricted",
				GeneralAccessRole:  "viewer",
				UserAccess:         make([]UserAccessEntry, 0),
				PendingInvites:     make([]PendingInvite, 0),
			},
		},
		{
			PutAccessRequest{
				MapId: m1.Id,
				Owner: &bob.Id,
			},
			Access{
				MapId:              m1.Id,
				Owner:              bob,
				GeneralAccessLevel: "restricted",
				GeneralAccessRole:  "viewer",
				UserAccess:         make([]UserAccessEntry, 0),
				PendingInvites:     make([]PendingInvite, 0),
			},
		},
		{
			PutAccessRequest{
				MapId:              m1.Id,
				Owner:              &alice.Id,
				GeneralAccessLevel: "public",
				GeneralAccessRole:  "editor",
				UserAccess: map[uuid.UUID]PutUserAccessEntry{
					bob.Id: {Role: "viewer"},
				},
				Invite: []InviteRequest{
					{
						Email:         "nonexistant@test.plantopo.com",
						Role:          "viewer",
						Notify:        true,
						NotifyMessage: "Hi there!",
					},
				},
			},
			Access{
				MapId:              m1.Id,
				Owner:              alice,
				GeneralAccessLevel: "public",
				GeneralAccessRole:  "editor",
				UserAccess: []UserAccessEntry{
					{User: *bob, Role: "viewer"},
				},
				PendingInvites: []PendingInvite{
					{
						Email: "nonexistant@test.plantopo.com",
						Role:  "viewer",
					},
				},
			},
		},
	}

	for _, scenario := range scenarios {
		s.T().Logf("scenario: %#v", scenario)
		err := subject.PutAccess(s.ctx, alice, scenario.req)
		require.NoError(s.T(), err)
		got, err := subject.Access(s.ctx, m1.Id)
		require.NoError(s.T(), err)
		require.Equal(s.T(), &scenario.want, got)
	}
}

func (s *S) TestCannotPutUserAccessToOwner() {
	subject := makeSubject(s)
	alice := makeUser(s)
	bob := makeUser(s)
	m1, err := subject.Create(s.ctx, alice.Id)
	require.NoError(s.T(), err)

	err = subject.PutAccess(s.ctx, alice, PutAccessRequest{
		MapId: m1.Id,
		UserAccess: map[uuid.UUID]PutUserAccessEntry{
			bob.Id: {Role: "owner"},
		},
	})
	require.Error(s.T(), err)
}

func (s *S) TestDuplicateInvite() {
	subject := makeSubject(s)
	alice := makeUser(s)
	m1, err := subject.Create(s.ctx, alice.Id)
	require.NoError(s.T(), err)

	err = subject.Invite(s.ctx, alice, InviteRequest{
		MapId: m1.Id,
		Email: "nonexistant@test.plantopo.com",
		Role:  "viewer",
	})
	require.NoError(s.T(), err)

	err = subject.Invite(s.ctx, alice, InviteRequest{
		MapId: m1.Id,
		Email: "nonexistant@test.plantopo.com",
		Role:  "viewer",
	})
	require.NoError(s.T(), err)

	err = subject.Invite(s.ctx, alice, InviteRequest{
		MapId: m1.Id,
		Email: "nonexistant@test.plantopo.com",
		Role:  "editor",
	})
	require.NoError(s.T(), err)
}
