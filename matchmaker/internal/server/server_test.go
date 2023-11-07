package server

import (
	"context"
	"net"
	"testing"

	api "github.com/danielzfranklin/plantopo/api/v1"
	"github.com/danielzfranklin/plantopo/matchmaker/internal"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

func TestServer(t *testing.T) {
	for scenario, fn := range map[string]func(
		t *testing.T,
		client api.MatchmakerClient,
		config *Config,
	){
		"setup connection":   testSetupConnection,
		"register close":     testRegisterClose,
		"register backend":   testRegisterBackend,
		"unregister backend": testUnregisterBackend,
	} {
		t.Run(scenario, func(t *testing.T) {
			client, config, teardown := setupTest(t, nil)
			defer teardown()
			fn(t, client, config)
		})
	}
}

type noopMatchmaker struct{}

func (noopMatchmaker) SetupConnection(_ context.Context, _ string) (internal.Connection, error) {
	return internal.Connection{
		Backend: "backend",
		Token:   "token",
	}, nil
}

func (noopMatchmaker) RegisterClose(_ string, _ string) {}

func (noopMatchmaker) AddBackends(_ []internal.Backend) {}

func (noopMatchmaker) RemoveBackends(_ []string) {}

func (noopMatchmaker) Stats() map[string]interface{} {
	return map[string]interface{}{}
}

func (noopMatchmaker) DebugState() string {
	return ""
}

func setupTest(t *testing.T, fn func(*Config)) (
	client api.MatchmakerClient,
	cfg *Config,
	teardown func(),
) {
	t.Helper()

	l, err := net.Listen("tcp", ":0")
	require.NoError(t, err)

	clientOptions := []grpc.DialOption{
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	}
	cc, err := grpc.Dial(l.Addr().String(), clientOptions...)
	require.NoError(t, err)

	cfg = &Config{
		Matchmaker: noopMatchmaker{},
		BackendDialOptions: []grpc.DialOption{
			grpc.WithTransportCredentials(insecure.NewCredentials()),
		},
	}
	if fn != nil {
		fn(cfg)
	}
	server, err := NewGRPCServer(cfg)
	require.NoError(t, err)

	go func() {
		_ = server.Serve(l)
	}()

	client = api.NewMatchmakerClient(cc)

	return client, cfg, func() {
		server.Stop()
		_ = cc.Close()
		_ = l.Close()
	}
}

func testSetupConnection(t *testing.T, client api.MatchmakerClient, _ *Config) {
	ctx := context.Background()
	resp, err := client.SetupConnection(ctx, &api.MatchmakerSetupConnectionRequest{
		MapId: "mapId",
	})
	require.NoError(t, err)
	require.Equal(t, "backend", resp.Backend)
	require.Equal(t, "token", resp.Token)
}

func testRegisterClose(t *testing.T, client api.MatchmakerClient, _ *Config) {
	ctx := context.Background()
	_, err := client.RegisterClose(ctx, &api.MatchmakerRegisterCloseRequest{
		Backend: "backend",
		MapId:   "mapId",
	})
	require.NoError(t, err)
}

func testRegisterBackend(t *testing.T, client api.MatchmakerClient, _ *Config) {
	ctx := context.Background()
	_, err := client.RegisterBackend(ctx, &api.MatchmakerRegisterBackendRequest{
		Backend: "backend",
	})
	require.NoError(t, err)
}

func testUnregisterBackend(t *testing.T, client api.MatchmakerClient, _ *Config) {
	ctx := context.Background()
	_, err := client.UnregisterBackend(ctx, &api.MatchmakerUnregisterBackendRequest{
		Backend: "backend",
	})
	require.NoError(t, err)
}
