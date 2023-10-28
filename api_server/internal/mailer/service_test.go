package mailer

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/danielzfranklin/plantopo/api_server/internal/types"
	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

type mockSender struct{ mock.Mock }

func (m *mockSender) Send(p Payload) error {
	args := m.Called(p)
	return args.Error(0)
}

func setup(t *testing.T) (*impl, *mockSender) {
	sender := new(mockSender)
	subject := New(context.Background(), Config{Sender: sender})
	return subject.(*impl), sender
}

func validUser() types.User {
	return types.User{
		Id:        uuid.New(),
		Email:     "doe@example.com",
		FullName:  "John Doe",
		CreatedAt: time.Now(),
	}
}

func TestSendConfirmation(t *testing.T) {
	subject, sender := setup(t)
	user := validUser()
	token := "valid-token"

	sender.On("Send", Payload{
		to:      "doe@example.com",
		subject: "Confirm your email to get started with PlanTopo",
		textBody: `Hi John Doe

Confirm your email address to get started with PlanTopo.

Click or paste this link to confirm:

https://plantopo.com/confirm/?token=valid-token

If you have any questions or need help please contact me at
daniel@plantopo.com
`}).Return(nil)

	err := subject.SendConfirmation(&user, token)
	require.NoError(t, err)

	sender.AssertExpectations(t)
}

func TestSendPasswordReset(t *testing.T) {
	subject, sender := setup(t)
	user := validUser()
	token := "valid-token"

	sender.On("Send", Payload{
		to:      "doe@example.com",
		subject: "Your password reset link for PlanTopo",
		textBody: `Hi John Doe

A request has been made to reset your password for your account on PlanTopo.

Click or paste this link to reset your password:

https://plantopo.com/login/forgot-password/reset/?token=valid-token

No changes have been made to your account yet.

If you have any questions or need help please contact me at
daniel@plantopo.com
`}).Return(nil)

	err := subject.SendPasswordReset(&user, token)
	require.NoError(t, err)

	sender.AssertExpectations(t)
}

func TestSendShareNotificationWithMessage(t *testing.T) {
	subject, sender := setup(t)
	alice := types.User{
		Id:       uuid.New(),
		Email:    "alice@example.com",
		FullName: "Alice Smith",
	}
	bob := types.User{
		Id:       uuid.New(),
		Email:    "bob@example.com",
		FullName: "Bob Jones",
	}
	meta := types.MapMeta{
		Id:   "d1",
		Name: "Trip to Alaska",
	}

	sender.On("Send", Payload{
		to:      "bob@example.com",
		subject: "Alice Smith shared \"Trip to Alaska\" with you on PlanTopo",
		textBody: `Hi Bob Jones,

Alice Smith shared "Trip to Alaska" with you on PlanTopo.

You can view the map here:

https://plantopo.com/map/d1/

Alice Smith says:

> Let's plan our trip to Alaska!

`,
	}).Return(nil)

	err := subject.SendShareNotification(ShareNotificationRequest{
		From:    &alice,
		To:      &bob,
		Map:     &meta,
		Message: "Let's plan our trip to Alaska!",
	})
	require.NoError(t, err)

	sender.AssertExpectations(t)
}

func TestSendShareNotificationWithoutMessage(t *testing.T) {
	subject, sender := setup(t)
	alice := types.User{
		Id:       uuid.New(),
		Email:    "alice@example.com",
		FullName: "Alice Smith",
	}
	bob := types.User{
		Id:       uuid.New(),
		Email:    "bob@example.com",
		FullName: "Bob Jones",
	}
	meta := types.MapMeta{
		Id:   "d1",
		Name: "Trip to Alaska",
	}

	sender.On("Send", Payload{
		to:      "bob@example.com",
		subject: "Alice Smith shared \"Trip to Alaska\" with you on PlanTopo",
		textBody: `Hi Bob Jones,

Alice Smith shared "Trip to Alaska" with you on PlanTopo.

You can view the map here:

https://plantopo.com/map/d1/

`,
	}).Return(nil)

	err := subject.SendShareNotification(ShareNotificationRequest{
		From:    &alice,
		To:      &bob,
		Map:     &meta,
		Message: "",
	})
	require.NoError(t, err)

	sender.AssertExpectations(t)
}

func TestSendInvitationWithMessage(t *testing.T) {
	subject, sender := setup(t)
	alice := types.User{
		Id:       uuid.New(),
		Email:    "alice@example.com",
		FullName: "Alice Smith",
	}
	meta := types.MapMeta{
		Id:   "d1",
		Name: "Trip to Alaska",
	}

	sender.On("Send", Payload{
		to:      "bob@example.com",
		subject: "Alice Smith shared \"Trip to Alaska\" with you on PlanTopo",
		textBody: `Hi bob@example.com,

Alice Smith shared "Trip to Alaska" with you on PlanTopo.

PlanTopo is a tool for editing maps collaboratively.

You can sign up for an account here:

https://plantopo.com/signup/?returnTo=%2Fmap%2Fd1%2F&email=bob%40example.com

Alice Smith says:

> Let's plan our trip to Alaska!

`,
	}).Return(nil)

	err := subject.SendInvite(InviteRequest{
		From:    &alice,
		ToEmail: "bob@example.com",
		Map:     &meta,
		Message: "Let's plan our trip to Alaska!",
	})
	require.NoError(t, err)

	sender.AssertExpectations(t)
}

func TestSendInviteWithoutMessage(t *testing.T) {
	subject, sender := setup(t)
	alice := types.User{
		Id:       uuid.New(),
		Email:    "alice@example.com",
		FullName: "Alice Smith",
	}
	meta := types.MapMeta{
		Id:   "d1",
		Name: "Trip to Alaska",
	}

	sender.On("Send", Payload{
		to:      "bob@example.com",
		subject: "Alice Smith shared \"Trip to Alaska\" with you on PlanTopo",
		textBody: `Hi bob@example.com,

Alice Smith shared "Trip to Alaska" with you on PlanTopo.

PlanTopo is a tool for editing maps collaboratively.

You can sign up for an account here:

https://plantopo.com/signup/?returnTo=%2Fmap%2Fd1%2F&email=bob%40example.com

`,
	}).Return(nil)

	err := subject.SendInvite(InviteRequest{
		From:    &alice,
		ToEmail: "bob@example.com",
		Map:     &meta,
	})
	require.NoError(t, err)

	sender.AssertExpectations(t)
}

func TestSenderFails(t *testing.T) {
	subject, sender := setup(t)
	user := validUser()
	token := "valid-token"

	sender.On("Send", mock.Anything).Return(fmt.Errorf("mocked send error"))

	err := subject.SendConfirmation(&user, token)
	require.ErrorContains(t, err, "mocked send error")

	sender.AssertExpectations(t)
}
