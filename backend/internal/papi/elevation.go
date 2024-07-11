package papi

import (
	"context"
)

func (h *phandler) PostElevation(ctx context.Context, req *ElevationPostReq) (*ElevationPostOK, error) {
	return &ElevationPostOK{
		Elevation: make([]float64, 0),
	}, nil
}
