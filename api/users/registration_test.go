package users

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestValidateRegistration(t *testing.T) {
	scenarios := []struct {
		req  RegistraterRequest
		want *ErrRegistrationIssue
	}{
		{
			RegistraterRequest{},
			&ErrRegistrationIssue{
				Email:                "is required",
				FullName:             "is required",
				Password:             "is required",
				PasswordConfirmation: "is required",
			},
		},
		{
			RegistraterRequest{
				FullName:             "Test",
				Password:             "testpassword",
				PasswordConfirmation: "nottestpassword",
			},
			&ErrRegistrationIssue{
				Email:                "is required",
				PasswordConfirmation: "must match password",
			},
		},
		{
			RegistraterRequest{
				FullName:             "Test",
				Email:                "test@example.com",
				Password:             "1",
				PasswordConfirmation: "not1",
			},
			&ErrRegistrationIssue{
				Password:             "must be at least 8 characters",
				PasswordConfirmation: "must match password",
			},
		},
		{
			RegistraterRequest{
				FullName:             "Test",
				Email:                "test@example.com",
				Password:             strings.Repeat("1", 73),
				PasswordConfirmation: strings.Repeat("1", 73),
			},
			&ErrRegistrationIssue{
				Password: "must not be more than 72 characters",
			},
		},
		{
			RegistraterRequest{
				FullName:             "Test",
				Email:                "test@example.com",
				Password:             "notascii☺️",
				PasswordConfirmation: "notascii☺️",
			},
			&ErrRegistrationIssue{
				Password: "may only contain letters, numbers, and symbols ~`! @#$%^&*()_-+={[}]|\\:;\"'<,>.?/",
			},
		},
		{
			RegistraterRequest{
				FullName:             "Test",
				Email:                "test@example.com",
				Password:             "Aa1~`! @#$%^&*()_-+={[}]|\\:;\"'<,>.?/",
				PasswordConfirmation: "Aa1~`! @#$%^&*()_-+={[}]|\\:;\"'<,>.?/",
			},
			nil,
		},
		{
			RegistraterRequest{
				FullName:             "Test",
				Email:                "invalid",
				Password:             "Aa1~`! @#$%^&*()_-+={[}]|\\:;\"'<,>.?/",
				PasswordConfirmation: "Aa1~`! @#$%^&*()_-+={[}]|\\:;\"'<,>.?/",
			},
			&ErrRegistrationIssue{
				Email: "is invalid",
			},
		},
		{
			RegistraterRequest{
				FullName:             strings.Repeat("a", 256),
				Email:                strings.Repeat("a", 256) + "@example.com",
				Password:             strings.Repeat("1", 73),
				PasswordConfirmation: strings.Repeat("1", 73),
			},
			&ErrRegistrationIssue{
				FullName: "must not be more than 255 characters",
				Email:    "must not be more than 255 characters",
				Password: "must not be more than 72 characters",
			},
		},
	}

	for _, scenario := range scenarios {
		t.Logf("scenario: %+v", scenario)
		got := scenario.req.Validate()
		require.Equal(t, scenario.want, got)
	}
}
