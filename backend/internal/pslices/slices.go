package pslices

import (
	"cmp"
	"slices"
)

func Filter[T any](slice []T, pred func(T) bool) []T {
	if slice == nil {
		return nil
	}
	out := make([]T, 0, len(slice))
	for _, item := range slice {
		if pred(item) {
			out = append(out, item)
		}
	}
	return out
}

func Map[T any, V any](slice []T, fn func(T) V) []V {
	if slice == nil {
		return nil
	}
	out := make([]V, 0, len(slice))
	for _, item := range slice {
		out = append(out, fn(item))
	}
	return out
}

func SortBy[S interface{ ~[]A }, A any, B cmp.Ordered](x S, fn func(A) B) {
	slices.SortFunc(x, func(a, b A) int {
		return cmp.Compare(fn(a), fn(b))
	})
}
