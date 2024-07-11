package papi

import (
	"context"
	"net/http"
)

func (h *phandler) PostElevation(ctx context.Context, req *ElevationPostReq) (*ElevationPostOK, error) {
	if len(req.Coordinates) == 0 {
		return &ElevationPostOK{Elevation: make([]float64, 0)}, nil
	}
	var coords [][2]float64
	for _, item := range req.Coordinates {
		if len(item) != 2 {
			return nil, &ErrorResponseStatusCode{
				StatusCode: http.StatusBadRequest,
				Response:   ErrorResponse{Message: "invalid coordinate"},
			}
		}
		coords = append(coords, [2]float64{item[0], item[1]})
	}

	value, err := h.elevation.Lookup(ctx, coords)
	if err != nil {
		return nil, err
	}

	var elevs []float64
	for _, item := range value {
		elevs = append(elevs, float64(item))
	}

	return &ElevationPostOK{elevs}, nil
}
