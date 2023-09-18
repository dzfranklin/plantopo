package users

import "strings"

func validateEmail(email string) string {
	if email == "" {
		return "is required"
	} else if !strings.ContainsRune(email, '@') {
		return "is invalid"
	} else if len(email) > 255 {
		return "must not be more than 255 characters"
	}
	return ""
}

func validateFullName(fullName string) string {
	if fullName == "" {
		return "is required"
	} else if len(fullName) > 255 {
		return "must not be more than 255 characters"
	}
	return ""
}

var passwordPermittedSymbols = "~`! @#$%^&*()_-+={[}]|\\:;\"'<,>.?/"

func validatePassword(password string) string {
	if password == "" {
		return "is required"
	} else if len(password) < 8 {
		return "must be at least 8 characters"
	} else if len(password) > 72 {
		return "must not be more than 72 characters"
	} else {
		for _, c := range password {
			if ('A' <= c && c <= 'Z') || ('a' <= c && c <= 'z') ||
				('0' <= c && c <= '9') || strings.ContainsRune(passwordPermittedSymbols, c) {
				continue
			} else {
				return "may only contain English letters, numbers, and symbols " + passwordPermittedSymbols
			}
		}
	}
	return ""
}
