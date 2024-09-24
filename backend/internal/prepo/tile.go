package prepo

import "errors"

type ZXY struct {
	Z int
	X int
	Y int
}

func (xyz ZXY) Validate() error {
	if xyz.Z > 32 || xyz.Z < 0 {
		return ErrTileOutsideBounds
	}
	worldTileSize := int(1) << uint(xyz.Z)
	if xyz.X < 0 || xyz.X >= worldTileSize ||
		xyz.Y < 0 || xyz.Y >= worldTileSize {
		return ErrTileOutsideBounds
	}
	return nil
}

var ErrTileOutsideBounds = errors.New("tile outside bounds")
