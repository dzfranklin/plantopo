package internal

import (
	"context"

	api "github.com/danielzfranklin/plantopo/api/v1"
)

type GRPCMatchmaker struct {
	c api.MatchmakerClient
}

func NewMatchmaker(c api.MatchmakerClient) *GRPCMatchmaker {
	return &GRPCMatchmaker{c}
}

func (m *GRPCMatchmaker) RegisterClose(
	ctx context.Context, backend string, mapId string,
) error {
	_, err := m.c.RegisterClose(
		ctx,
		&api.MatchmakerRegisterCloseRequest{
			Backend: backend,
			MapId:   mapId,
		},
	)
	return err
}

func (m *GRPCMatchmaker) RegisterBackend(
	ctx context.Context, backend string,
) error {
	_, err := m.c.RegisterBackend(
		ctx,
		&api.MatchmakerRegisterBackendRequest{
			Backend: backend,
		},
	)
	return err
}

func (m *GRPCMatchmaker) UnregisterBackend(
	ctx context.Context, backend string,
) error {
	_, err := m.c.UnregisterBackend(
		ctx,
		&api.MatchmakerUnregisterBackendRequest{
			Backend: backend,
		},
	)
	return err
}
