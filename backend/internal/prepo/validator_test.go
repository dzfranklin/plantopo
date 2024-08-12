package prepo

import (
	"fmt"
	"strings"
	"testing"
)

func TestValidator_CheckEmail(t *testing.T) {
	t.Parallel()
	cases := []struct {
		input    string
		expected string
	}{
		{"foo@root", ""},
		{"invalid", "is invalid"},
		{"normal@gmail.com", ""},
		{"", "is invalid"},
	}
	for _, c := range cases {
		t.Run(fmt.Sprintf("input: %s", c.input), func(t *testing.T) {
			subject := Validator{}
			subject.CheckEmail(c.input, "field")
			got := subject.FieldErrors["field"]

			if got != c.expected {
				t.Errorf("got %s, expected %s", got, c.expected)
			}
		})
	}
}

func TestValidator_CheckPassword(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name     string
		input    string
		expected string
	}{
		{"short", "pass", "must be at least 8 characters"},
		{"long", strings.Repeat("long", 100), "must not be more than 100 characters"},
		{"weak", "password", "is too weak"},
		{"good_enough", "58435918", ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			subject := Validator{}
			subject.CheckPassword(c.input, "field", 1, nil)
			got := subject.FieldErrors["field"]

			if got != c.expected {
				t.Errorf("got %s, expected %s", got, c.expected)
			}
		})
	}
}
