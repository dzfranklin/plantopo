package pweather

import (
	"errors"
	"fmt"
)

var (
	ErrNotFound = errors.New("not found")
)

type ErrAmbiguousPlaceName struct {
	Candidate1 string
	Candidate2 string
}

func (e ErrAmbiguousPlaceName) Error() string {
	return fmt.Sprintf("ambiguous place name: %s vs %s", e.Candidate1, e.Candidate2)
}
