package server

import (
	"context"
	"net"
	"testing"
	"time"

	api "github.com/danielzfranklin/plantopo/api/v1"
	"github.com/danielzfranklin/plantopo/sync_backend/internal/backend"
	"github.com/danielzfranklin/plantopo/sync_backend/internal/session"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/protobuf/types/known/emptypb"
)

func init() {
	l, err := zap.NewDevelopment()
	if err != nil {
		panic(err)
	}
	zap.ReplaceGlobals(l)
}

func TestServer(t *testing.T) {
	for scenario, fn := range map[string]func(
		t *testing.T,
		client api.SyncBackendClient,
		config *Config,
	){
		"setup connection": testSetupConnection,
		"connect":          testConnect,
		"stats":            testStats,
		"debug state":      testDebugState,
	} {
		t.Run(scenario, func(t *testing.T) {
			client, config, teardown := setupTest(t, nil)
			defer teardown()
			fn(t, client, config)
		})
	}
}

func testSetupConnection(t *testing.T, client api.SyncBackendClient, config *Config) {
	ctx := context.Background()
	_, err := client.SetupConnection(ctx, &api.SyncBackendSetupConnectionRequest{
		MapId: "mapid",
		Token: "foo",
	})
	require.NoError(t, err)
}

func testConnect(t *testing.T, client api.SyncBackendClient, config *Config) {
	ctx := context.Background()
	conn, err := client.Connect(ctx)
	require.NoError(t, err)

	msg := &api.SyncBackendIncomingMessage{Msg: &api.SyncBackendIncomingMessage_Connect{
		Connect: &api.SyncBackendConnectRequest{
			Token: "foo",
		},
	}}
	require.NoError(t, conn.Send(msg))

	got, err := conn.Recv()
	require.NoError(t, err)
	require.NotEmpty(t, got.Data)

	msg = &api.SyncBackendIncomingMessage{Msg: &api.SyncBackendIncomingMessage_Update{
		Update: &api.SyncBackendIncomingUpdate{
			Seq: 1,
		},
	}}
	require.NoError(t, conn.Send(msg))

	got, err = conn.Recv()
	require.NoError(t, err)
	require.NotEmpty(t, got.Data)

	require.NoError(t, conn.CloseSend())
}

func testStats(t *testing.T, client api.SyncBackendClient, config *Config) {
	ctx := context.Background()

	got, err := client.Stats(ctx, &emptypb.Empty{})
	require.NoError(t, err)

	require.Equal(t, map[string]interface{}{"foo": float64(42)}, got.AsMap())
}

func testDebugState(t *testing.T, client api.SyncBackendClient, config *Config) {
	ctx := context.Background()
	_, err := client.DebugState(ctx, &emptypb.Empty{})
	require.NoError(t, err)
}

func setupTest(t *testing.T, fn func(*Config)) (
	client api.SyncBackendClient,
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
		Backend: &mockBackend{},
	}
	if fn != nil {
		fn(cfg)
	}
	server, err := NewGRPCServer(cfg)
	require.NoError(t, err)

	go func() {
		_ = server.Serve(l)
	}()

	client = api.NewSyncBackendClient(cc)

	return client, cfg, func() {
		server.Stop()
		_ = cc.Close()
		_ = l.Close()
	}
}

type mockBackend struct{}

func (mockBackend) SetupConnection(mapId string, token string) error {
	return nil
}

func (mockBackend) Connect(mapId string, token string, connectionId string) (backend.Connection, error) {
	return newMockConn(), nil
}

func (mockBackend) Stats() map[string]interface{} {
	return map[string]interface{}{"foo": 42}
}

func (mockBackend) DebugState() string {
	return "dbg"
}

type mockConn struct {
	outgoing chan session.Outgoing
}

func newMockConn() *mockConn {
	c := make(chan session.Outgoing)
	go func() {
		for {
			time.Sleep(1 * time.Millisecond)
			c <- session.Outgoing{}
		}
	}()
	return &mockConn{outgoing: c}
}

func (*mockConn) Close() {}

func (*mockConn) Receive(input session.Incoming) error {
	return nil
}

func (m *mockConn) Outgoing() chan session.Outgoing {
	return m.outgoing
}
