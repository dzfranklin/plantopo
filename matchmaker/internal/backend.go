package internal

import (
	"context"
	"fmt"

	api "github.com/danielzfranklin/plantopo/api/v1"
	"go.uber.org/zap"
	"google.golang.org/grpc"
)

type GRPCBackend struct {
	id     string
	client api.SyncBackendClient
}

func NewGRPCBackend(addr string, opts ...grpc.DialOption) (*GRPCBackend, error) {
	cc, err := grpc.Dial(addr, opts...)
	if err != nil {
		zap.S().Warnw("failed to dial backend", "addr", addr, "err", zap.Error(err))
		return nil, fmt.Errorf("failed to dial backend %s: %w", addr, err)
	}
	c := api.NewSyncBackendClient(cc)
	return &GRPCBackend{addr, c}, nil
}

func (b *GRPCBackend) Id() string {
	return b.id
}

func (b *GRPCBackend) SetupConnection(
	ctx context.Context, mapId string, token string,
) error {
	_, err := b.client.SetupConnection(ctx, &api.SyncBackendSetupConnectionRequest{
		MapId: mapId,
		Token: token,
	})
	return err
}
