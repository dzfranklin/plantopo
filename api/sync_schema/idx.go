package sync_schema

import (
	"fmt"
	"math/rand"
)

// From <https://madebyevan.com/algos/crdt-fractional-indexing/>

const (
	minDigit  = uint(' ')
	maxDigit  = uint('~')
	maxJitter = 0x10
)

func validateInsertibleIdx(idx string) error {
	if len(idx) == 0 {
		return fmt.Errorf("cannot insert at empty idx")
	}
	return validateIdxDigits(idx)
}

func validateIdxDigits(value string) error {
	for i := 0; i < len(value); i++ {
		digit := uint(value[i])
		if digit < minDigit || digit > maxDigit {
			return fmt.Errorf("idx digit out of range: %c", digit)
		}
	}
	return nil
}

// IdxBetweenStatic is like IdxBetween except it panics if inputs are invalid and doesn't add jitter.
func IdxBetweenStatic(before string, after string) string {
	res, err := idxBetween(nil, before, after, false)
	if err != nil {
		panic(fmt.Errorf("IdxBetweenStatic got invalid input(s): %w", err))
	}
	return res
}

func IdxBetween(rng *rand.Rand, before string, after string) (string, error) {
	return idxBetween(rng, before, after, true)
}

func idxBetween(rng *rand.Rand, before string, after string, addJitter bool) (string, error) {
	if err := validateIdxDigits(before); err != nil {
		return "", err
	}
	if err := validateIdxDigits(after); err != nil {
		return "", err
	}

	foundDifference := false
	result := make([]byte, 0, len(before))
	i := 0
	for {
		// Pretend all digits past the end of the "before" position are
		// "0" (our minimum digit).
		var digitBefore uint
		if i < len(before) {
			digitBefore = uint(before[i])
		} else {
			digitBefore = minDigit
		}

		// Pretend all digits past the end of the "after" position are
		// "10" (one past our maximum digit). We do this because generated
		// digits must be less than this number and we want to be able to
		// generate "maxDigit" at the end of a generated position.
		var digitAfter uint
		if !foundDifference && i < len(after) {
			digitAfter = uint(after[i])
		} else {
			digitAfter = maxDigit + 1
		}

		// Try to split the difference at the halfway point. This will round down,
		// and only the upper value is ever equal to "maxDigit + 1", so the halfway
		// point will always be less than or equal to "maxDigit".
		pick := (digitBefore + digitAfter) >> 1
		result = append(result, byte(pick))

		// If the difference is too small, continue to the next digit. We don't
		// need to test the upper number since the division by two always rounds
		// down. So if it's greater than the lower bound, then it must therefore
		// also be less than the upper bound.
		if pick <= digitBefore {
			// If the rounded halfway point is equal to the "before" digit but the
			// "before" and "after" digits are different, then the difference between
			// them must be 1. In that case we want to treat all remaining "after"
			// digits as larger than the maximum digit value since we have reached the
			// end of the common shared prefix.
			//
			// For example, for "0.19" and "0.23" we won't be able to generate a digit
			// in between "1" and "2" so we need to continue to the next digit pair,
			// but we don't want to try to average "9" and "3" to get a digit since
			// the next digit must be greater than or equal to "9". So instead we want
			// to average "9" and a value greater than the maximum digit (i.e. "10").
			if digitBefore < digitAfter {
				foundDifference = true
			}

			i++
			continue
		}

		// Otherwise, return the halfway point plus random jitter to avoid
		// collisions in the case where two peers try to concurrently insert
		// between the same positions.
		//
		// The random jitter is added as random extra digits past the end of the
		// fraction. This will never push the generated position past "next"
		// because we know that "pick" is already less than "next". For example,
		// "0.014abc" is always less than "0.015xyz" for all "abc" and "xyz".
		// This implementation avoids unnecessarily append trailing "0" digits
		// to the end.
		//
		// Note that the fact that the random jitter is always a non-negative
		// number will bias the result slightly. This doesn't matter when we
		// use a large base so the bias is small. The bias only really matters
		// for smaller bases such as base 2.
		if addJitter {
			jitter := uint(rng.Intn(maxJitter))
			for jitter > 0 {
				base := maxDigit - minDigit + 1
				mod := jitter % base
				jitter = (jitter - mod) / base
				result = append(result, byte(minDigit+mod))
			}
		}

		return string(result), nil
	}
}
