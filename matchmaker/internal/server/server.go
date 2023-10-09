package server

import (
	"context"

	api "github.com/danielzfranklin/plantopo/api/v1"
	"github.com/danielzfranklin/plantopo/matchmaker/internal"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/structpb"
)

var _ api.MatchmakerServer = (*grpcServer)(nil)

type Matchmaker interface {
	SetupConnection(ctx context.Context, mapId string) (internal.Connection, error)
	AddBackends(backends []internal.Backend)
	RemoveBackends(backends []string)
	RegisterClose(backend string, mapId string)
	Stats() map[string]interface{}
	DebugState() string
}

type Config struct {
	Matchmaker         Matchmaker
	BackendDialOptions []grpc.DialOption
}

type grpcServer struct {
	api.UnimplementedMatchmakerServer
	*Config
}

func NewGRPCServer(config *Config) (*grpc.Server, error) {
	gsrv := grpc.NewServer()
	reflection.Register(gsrv)
	srv := newGrpcServer(config)
	api.RegisterMatchmakerServer(gsrv, srv)
	return gsrv, nil
}

func newGrpcServer(config *Config) *grpcServer {
	return &grpcServer{Config: config}
}

func (s *grpcServer) SetupConnection(
	ctx context.Context, req *api.MatchmakerSetupConnectionRequest,
) (*api.MatchmakerSetupConnectionResponse, error) {
	conn, err := s.Matchmaker.SetupConnection(ctx, req.MapId)
	if err != nil {
		return nil, err
	}
	return &api.MatchmakerSetupConnectionResponse{
		Backend: conn.Backend,
		Token:   conn.Token,
	}, nil
}

func (s *grpcServer) RegisterBackend(
	ctx context.Context, req *api.MatchmakerRegisterBackendRequest,
) (*api.MatchmakerRegisterBackendResponse, error) {
	b, err := internal.NewGRPCBackend(req.Backend, s.BackendDialOptions...)
	if err != nil {
		return nil, err
	}
	s.Matchmaker.AddBackends([]internal.Backend{b})
	return &api.MatchmakerRegisterBackendResponse{}, nil
}

func (s *grpcServer) UnregisterBackend(
	ctx context.Context, req *api.MatchmakerUnregisterBackendRequest,
) (*api.MatchmakerUnregisterBackendResponse, error) {
	s.Matchmaker.RemoveBackends([]string{req.Backend})
	return &api.MatchmakerUnregisterBackendResponse{}, nil
}

func (s *grpcServer) RegisterClose(
	ctx context.Context, req *api.MatchmakerRegisterCloseRequest,
) (*api.MatchmakerRegisterCloseResponse, error) {
	s.Matchmaker.RegisterClose(req.Backend, req.MapId)
	return &api.MatchmakerRegisterCloseResponse{}, nil
}

func (s *grpcServer) Stats(ctx context.Context, _ *emptypb.Empty) (*structpb.Struct, error) {
	stats := s.Matchmaker.Stats()
	return structpb.NewStruct(stats)
}

func (s *grpcServer) DebugState(ctx context.Context, _ *emptypb.Empty) (*structpb.Struct, error) {
	state := s.Matchmaker.DebugState()
	return structpb.NewStruct(map[string]interface{}{
		"state": state,
	})
}
