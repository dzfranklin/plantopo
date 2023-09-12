package mailer

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/danielzfranklin/plantopo/api/user"
	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

type mockSender struct{ mock.Mock }

func (m *mockSender) send(p payload) error {
	args := m.Called(p)
	return args.Error(0)
}

func setup(t *testing.T) (*impl, *mockSender) {
	sender := new(mockSender)
	subject, err := New(context.Background(), Config{sender: sender})
	require.NoError(t, err)
	return subject, sender
}

func validUser() user.User {
	return user.User{
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

	sender.On("send", payload{
		to:      "doe@example.com",
		subject: "Confirm your email to get started with PlanTopo",
		textBody: `Hi John Doe

Confirm your email address to get started with PlanTopo.

Click or paste this link: https://api.plantopo.com/confirm?token=valid-token
`}).Return(nil)

	err := subject.SendConfirmation(user, token)
	require.NoError(t, err)

	sender.AssertExpectations(t)
}

func TestSenderFails(t *testing.T) {
	subject, sender := setup(t)
	user := validUser()
	token := "valid-token"

	sender.On("send", mock.Anything).Return(fmt.Errorf("mocked send error"))

	err := subject.SendConfirmation(user, token)
	require.ErrorContains(t, err, "mocked send error")

	sender.AssertExpectations(t)
}
