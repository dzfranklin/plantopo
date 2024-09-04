package papi

import (
	"bytes"
	"context"
)

func (h *phandler) GeophotosTileZXYMvtGzGet(ctx context.Context, params GeophotosTileZXYMvtGzGetParams) (*MVTTileHeaders, error) {
	b, err := h.Repo.Geophotos.GetTile(ctx, params.Z, params.X, params.Y)
	if err != nil {
		return nil, err
	}
	return &MVTTileHeaders{
		ContentEncoding: NewOptString("gzip"),
		Response:        MVTTile{Data: bytes.NewReader(b)},
	}, nil
}
