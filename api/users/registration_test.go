package users

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestValidateRegistration(t *testing.T) {
	scenarios := []struct {
		req  RegisterRequest
		want *ErrRegistrationIssue
	}{
		{
			RegisterRequest{},
			&ErrRegistrationIssue{
				Email:    "is required",
				FullName: "is required",
				Password: "is required",
			},
		},
		{
			RegisterRequest{
				FullName: "Test",
				Password: "testpassword",
			},
			&ErrRegistrationIssue{
				Email: "is required",
			},
		},
		{
			RegisterRequest{
				FullName: "Test",
				Email:    "bob@test.plantopo.com",
				Password: "1",
			},
			&ErrRegistrationIssue{
				Password: "must be at least 8 characters",
			},
		},
		{
			RegisterRequest{
				FullName: "Test",
				Email:    "bob@test.plantopo.com",
				Password: strings.Repeat("1", 73),
			},
			&ErrRegistrationIssue{
				Password: "must not be more than 72 characters",
			},
		},
		{
			RegisterRequest{
				FullName: "Test",
				Email:    "bob@test.plantopo.com",
				Password: "notascii☺️",
			},
			&ErrRegistrationIssue{
				Password: "may only contain English letters, numbers, and symbols ~`! @#$%^&*()_-+={[}]|\\:;\"'<,>.?/",
			},
		},
		{
			RegisterRequest{
				FullName: "Test",
				Email:    "bob@test.plantopo.com",
				Password: "Aa1~`! @#$%^&*()_-+={[}]|\\:;\"'<,>.?/",
			},
			nil,
		},
		{
			RegisterRequest{
				FullName: "Test",
				Email:    "invalid",
				Password: "Aa1~`! @#$%^&*()_-+={[}]|\\:;\"'<,>.?/",
			},
			&ErrRegistrationIssue{
				Email: "is invalid",
			},
		},
		{
			RegisterRequest{
				FullName: strings.Repeat("a", 256),
				Email:    strings.Repeat("a", 256) + "@example.com",
				Password: strings.Repeat("1", 73),
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
