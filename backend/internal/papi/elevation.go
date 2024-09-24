package papi

import (
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/pslices"
	"github.com/tidwall/geojson/geometry"
)

func (h *phandler) ElevationPost(ctx context.Context, req *ElevationPostReq) (*ElevationPostOK, error) {
	if len(req.Coordinates) == 0 {
		return &ElevationPostOK{Elevation: make([]float64, 0)}, nil
	}
	var coords []geometry.Point
	for _, item := range req.Coordinates {
		if len(item) != 2 {
			return nil, badRequest("invalid coordinate")
		}
		coords = append(coords, geometry.Point{X: item[0], Y: item[1]})
	}

	value, err := h.elevation.Lookup(ctx, coords)
	if err != nil {
		return nil, err
	}

	return &ElevationPostOK{Elevation: pslices.Map(value, func(v int16) float64 { return float64(v) })}, nil
}
