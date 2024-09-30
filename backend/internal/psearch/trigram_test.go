package psearch

import (
	"github.com/stretchr/testify/assert"
	"testing"
)

func Test_trigramSimilarity(t *testing.T) {
	type args struct {
		a string
		b string
	}
	tests := []struct {
		name string
		args args
		want float64
	}{
		{name: "nothing in common", args: args{a: "one", b: "two"}, want: 0},
		{name: "partially common", args: args{a: "input one", b: "input two"}, want: 0.429},
		{name: "misspelled", args: args{a: "misspelled", b: "mispelled"}, want: 0.75},
		{name: "perfect match", args: args{a: "Beinn a' ghlo", b: "beinn aghlo"}, want: 1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := trigramSimilarity(tt.args.a, tt.args.b)
			assert.InDeltaf(t, tt.want, got, 0.0009, "trigramSimilarity(%v, %v)", tt.args.a, tt.args.b)
		})
	}
}

func Test_trigramsNormalized(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  []string
	}{
		{name: "one word ascii", input: "cat", want: []string{"  c", " ca", "cat", "at "}},
		{name: "two word ascii", input: "cat and", want: []string{"  c", " ca", "cat", "at ", "  a", " an", "and", "nd "}},
		{name: "extra spaces", input: "cat    \tand", want: []string{"  c", " ca", "cat", "at ", "  a", " an", "and", "nd "}},
		{name: "punctuation", input: "cat. and", want: []string{"  c", " ca", "cat", "at ", "  a", " an", "and", "nd "}},
		{name: "uppercase", input: "CAT", want: []string{"  c", " ca", "cat", "at "}},
		{name: "ignores apostrophe one letter", input: "a'Ghlo", want: []string{"  a", " ag", "agh", "ghl", "hlo", "lo "}},
		{name: "ignores apostrophe one letter after word", input: "a a'Ghlo", want: []string{"  a", " a ", "  a", " ag", "agh", "ghl", "hlo", "lo "}},
		{name: "ignores apostrophe with space", input: "a' Ghlo", want: []string{"  a", " ag", "agh", "ghl", "hlo", "lo "}},
		{name: "ignores curly apostrophe one letter", input: "a’Ghlo", want: []string{"  a", " ag", "agh", "ghl", "hlo", "lo "}},
		{name: "ignores apostrophe two letter unicode", input: "là'rna", want: []string{"  l", " la", "lar", "arn", "rna", "na "}},
		{name: "splits on apostrophe with long prefix", input: "some'words", want: []string{"  s", " so", "som", "ome", "me ", "  w", " wo", "wor", "ord", "rds", "ds "}},
		{name: "aphanum", input: "KY16", want: []string{"  k", " ky", "ky1", "y16", "16 "}},
		{name: "numeric", input: "16", want: []string{"  1", " 16", "16 "}},
		{name: "chinese_simplified", input: "中国", want: []string{"  中", " 中国", "中国 "}},
		{name: "gaelic", input: "Càrn", want: []string{"  c", " ca", "car", "arn", "rn "}},
		{name: "german", input: "Käse", want: []string{"  k", " ka", "kas", "ase", "se "}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equalf(t, tt.want, trigramsNormalized(tt.input), "trigramsNormalized(%v)", tt.input)
		})
	}
}

func Test_normalizeStringForTrigram(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{input: "Beinn a' ghlo", want: "beinn aghlo"},
	}
	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			assert.Equalf(t, tt.want, normalizeStringForTrigram(tt.input), "normalizeStringForTrigram(%v)", tt.input)
		})
	}
}
