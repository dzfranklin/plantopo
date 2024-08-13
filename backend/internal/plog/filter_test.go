package plog

import (
	"bytes"
	"encoding/json"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"log/slog"
	"testing"
)

type TestMsg struct {
	Msg   string
	Attr  string
	Group TestGroup
}

type TestGroup struct {
	Attr string
}

func TestFilters(t *testing.T) {
	var b bytes.Buffer
	base := slog.New(slog.NewJSONHandler(&b, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	subject := Filtered(base, slog.LevelWarn)

	base.Info("base info")
	subject.Info("subject info")

	base.Warn("base warn")
	subject.Warn("subject warn")

	subject.With("attr", "present").Info("filtered after with")
	subject.With("attr", "present").Warn("with attr")

	subject.WithGroup("group").With("attr", "present").Info("filtered after with group")
	subject.WithGroup("group").With("attr", "present").Warn("with group")

	var got []TestMsg
	dec := json.NewDecoder(&b)
	for dec.More() {
		var msg TestMsg
		err := dec.Decode(&msg)
		require.NoError(t, err)
		got = append(got, msg)
	}

	expected := []TestMsg{
		{Msg: "base info"},
		{Msg: "base warn"},
		{Msg: "subject warn"},
		{Msg: "with attr", Attr: "present"},
		{Msg: "with group", Group: TestGroup{"present"}},
	}
	assert.Equal(t, expected, got)
}
