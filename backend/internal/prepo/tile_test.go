package prepo

import (
	"fmt"
	"github.com/stretchr/testify/assert"
	"testing"
)

func TestXYZ_Validate(t *testing.T) {
	cases := []struct {
		XYZ   ZXY
		Valid bool
	}{
		{ZXY{1, 1, 1}, true},
		{ZXY{1, 100, 100}, false},
	}
	for _, c := range cases {
		t.Run(fmt.Sprintf("%v", c.XYZ), func(t *testing.T) {
			got := c.XYZ.Validate()
			if c.Valid {
				assert.NoError(t, got)
			} else {
				assert.ErrorIs(t, got, ErrTileOutsideBounds)
			}
		})
	}
}
