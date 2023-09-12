package users

import (
	"strings"
)

type RegistraterRequest struct {
	Email                string `json:"email"`
	FullName             string `json:"fullName"`
	Password             string `json:"password"`
	PasswordConfirmation string `json:"passwordConfirmation"`
}

type ErrRegistrationIssue struct {
	Email                string `json:"emailIssue,omitempty"`
	FullName             string `json:"fullNameIssue,omitempty"`
	Password             string `json:"passwordIssue,omitempty"`
	PasswordConfirmation string `json:"passwordConfirmationIssue,omitempty"`
}

func (e ErrRegistrationIssue) Error() string {
	return "registration issue"
}

var permittedSymbols = "~`! @#$%^&*()_-+={[}]|\\:;\"'<,>.?/"

func (r *RegistraterRequest) Validate() *ErrRegistrationIssue {
	var err ErrRegistrationIssue

	if r.Email == "" {
		err.Email = "is required"
	} else if !strings.ContainsRune(r.Email, '@') {
		err.Email = "is invalid"
	} else if len(r.Email) > 255 {
		err.Email = "must not be more than 255 characters"
	}

	if r.FullName == "" {
		err.FullName = "is required"
	} else if len(r.FullName) > 255 {
		err.FullName = "must not be more than 255 characters"
	}

	if r.Password == "" {
		err.Password = "is required"
	} else if len(r.Password) < 8 {
		err.Password = "must be at least 8 characters"
	} else if len(r.Password) > 72 {
		err.Password = "must not be more than 72 characters"
	} else {
		for _, c := range r.Password {
			if ('A' <= c && c <= 'Z') || ('a' <= c && c <= 'z') ||
				('0' <= c && c <= '9') || strings.ContainsRune(permittedSymbols, c) {
				continue
			} else {
				err.Password = "may only contain letters, numbers, and symbols " + permittedSymbols
				break
			}
		}
	}

	if r.PasswordConfirmation == "" {
		err.PasswordConfirmation = "is required"
	} else if r.Password != r.PasswordConfirmation {
		err.PasswordConfirmation = "must match password"
	}

	if err.Email == "" && err.Password == "" && err.PasswordConfirmation == "" {
		return nil
	} else {
		return &err
	}
}
