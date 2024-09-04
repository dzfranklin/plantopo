package papi

import (
	"bytes"
	"context"
)

func (h *phandler) GeophotosTileZXYMvtGzGet(ctx context.Context, params GeophotosTileZXYMvtGzGetParams) (MVTTile, error) {
	b, err := h.Repo.Geophotos.GetTile(ctx, params.Z, params.X, params.Y)
	if err != nil {
		return MVTTile{}, err
	}
	return MVTTile{Data: bytes.NewReader(b)}, nil
}
