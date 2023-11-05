package users

import (
	"fmt"
	"strings"
)

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type ErrLoginIssue struct {
	Email    string `json:"email,omitempty"`
	Password string `json:"password,omitempty"`
}

func (e ErrLoginIssue) Error() string {
	return fmt.Sprintf("login issue (emailIssue=%s, passwordIssue=%s)", e.Email, e.Password)
}

func (r LoginRequest) Validate() *ErrLoginIssue {
	issue := &ErrLoginIssue{}
	if r.Email == "" {
		issue.Email = "is required"
	} else if !strings.ContainsRune(r.Email, '@') {
		issue.Email = "is invalid"
	}

	if r.Password == "" {
		issue.Password = "is required"
	}

	if issue.Email == "" && issue.Password == "" {
		return nil
	} else {
		return issue
	}
}
