package sync_schema

import (
	"fmt"

	"github.com/mazznoer/csscolorparser"
)

func (t *Layer) validate() error {
	if t.IdxState == Set {
		if err := validateInsertibleIdx(t.Idx); err != nil {
			return err
		}
	}
	if t.OpacityState == Set {
		if t.Opacity < 0 || t.Opacity > 1 {
			return fmt.Errorf("opacity out of range: %f", t.Opacity)
		}
	}
	return nil
}

func (t *Feature) validate() error {
	if t.ParentState == Unset {
		return fmt.Errorf("cannot change feature parent to unset")
	}
	if t.IdxState == Unset {
		return fmt.Errorf("cannot change feature idx to unset")
	}
	if t.ParentState != t.IdxState {
		return fmt.Errorf("parent and idx must be changed together")
	}
	if t.IdxState == Set {
		if err := validateInsertibleIdx(t.Idx); err != nil {
			return err
		}
	}

	if t.ColorState == Set {
		if _, err := csscolorparser.Parse(t.Color); err != nil {
			return fmt.Errorf("invalid color: %w", err)
		}
	}
	return nil
}
