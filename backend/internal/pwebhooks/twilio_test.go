package pwebhooks

import (
	"github.com/stretchr/testify/require"
	"testing"
)

func TestParseIncomingMessageBody(t *testing.T) {
	cases := []struct {
		name     string
		input    string
		expected incomingMessageParts
	}{
		{"basic", "weather cairn gorm", incomingMessageParts{command: "weather", rest: "cairn gorm"}},
		{"padded", "  weather cairn gorm   ", incomingMessageParts{command: "weather", rest: "cairn gorm"}},
		{"capitalized", "Weather cairn gorm", incomingMessageParts{command: "weather", rest: "cairn gorm"}},
		{"inreach", "weather cairn gorm inreachlink.com/XUH72XZ  (56.3348, -2.7902) - Daniel Franklin", incomingMessageParts{command: "weather", rest: "cairn gorm", inreachCoordinates: [2]float64{-2.7902, 56.3348}}},
		{"invalid inreach", "weather cairn gorm inreachlink.com/XUH72XZ  (-2.7902) - Daniel Franklin", incomingMessageParts{command: "weather", rest: "cairn gorm inreachlink.com/XUH72XZ  (-2.7902) - Daniel Franklin"}},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := parseIncomingMessageBody(c.input)
			require.Equal(t, c.expected, got)
		})
	}
}
