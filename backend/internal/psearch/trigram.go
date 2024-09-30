package psearch

import (
	"golang.org/x/text/cases"
	"golang.org/x/text/language"
	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
	"regexp"
	"slices"
	"strings"
	"unicode"
)

func trigramSimilarity(a, b string) float64 {
	ta := trigramSet(a)
	tb := trigramSet(b)

	tc := make([]string, 0, len(ta)+len(tb))
	tc = append(tc, ta...)
	tc = append(tc, tb...)
	slices.Sort(tc)
	tc = slices.Compact(tc)

	common := 0
	for _, t := range ta {
		if slices.Contains(tb, t) {
			common++
		}
	}

	return float64(common) / float64(len(tc))
}

func trigramSet(input string) []string {
	t := trigramsNormalized(input)
	slices.Sort(t)
	return slices.Compact(t)
}

var trigramNormalizer = transform.Chain(
	norm.NFD,
	cases.Lower(language.English),
	runes.Remove(runes.In(unicode.Mn)),
	norm.NFC,
)

var apostropheInNameRe = regexp.MustCompile(`(\W|^)(\w{1,3})['’] ?(\w)`)

func normalizeStringForTrigram(input string) string {
	normalized, _, normalizeErr := transform.String(trigramNormalizer, input)
	if normalizeErr != nil {
		normalized = input
	}

	// This is imperfect, but it handles gaelic origin names like "a' Ghlo" better
	normalized = apostropheInNameRe.ReplaceAllString(normalized, "$1$2$3")

	return normalized
}

func trigramsNormalized(input string) []string {
	words := strings.FieldsFunc(normalizeStringForTrigram(input), func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsNumber(r)
	})

	out := make([]string, 0)
	for _, word := range words {
		var chars []string
		var ia norm.Iter
		ia.InitString(norm.NFC, "  "+word+" ")
		for !ia.Done() {
			c := ia.Next()
			chars = append(chars, string(c))
		}

		for i := range chars {
			if i+3 > len(chars) {
				break
			}
			out = append(out, strings.Join(chars[i:i+3], ""))
		}
	}

	return out
}
