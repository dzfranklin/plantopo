package server

import (
	"context"
	"encoding/json"
	"fmt"
	"io"

	schema "github.com/danielzfranklin/plantopo/api/sync_schema"
	api "github.com/danielzfranklin/plantopo/api/v1"
	"github.com/danielzfranklin/plantopo/sync_backend/internal/backend"
	"github.com/danielzfranklin/plantopo/sync_backend/internal/session"
	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/structpb"
	"google.golang.org/protobuf/types/known/wrapperspb"
)

var _ api.SyncBackendServer = (*grpcServer)(nil)

type Backend interface {
	SetupConnection(mapId string, token string) error
	Connect(mapId string, token string, connectionId string) (backend.Connection, error)
	Stats() map[string]interface{}
	DebugState() string
}

type Config struct {
	Backend Backend
}

type grpcServer struct {
	api.UnimplementedSyncBackendServer
	*Config
}

func NewGRPCServer(config *Config) (*grpc.Server, error) {
	gsrv := grpc.NewServer()
	reflection.Register(gsrv)
	srv := newGrpcServer(config)
	api.RegisterSyncBackendServer(gsrv, srv)
	return gsrv, nil
}

func newGrpcServer(config *Config) *grpcServer {
	return &grpcServer{Config: config}
}

func (s *grpcServer) SetupConnection(
	ctx context.Context, req *api.SyncBackendSetupConnectionRequest,
) (*api.SyncBackendSetupConnectionResponse, error) {
	err := s.Backend.SetupConnection(req.MapId, req.Token)
	if err != nil {
		return nil, err
	}
	return &api.SyncBackendSetupConnectionResponse{}, nil
}

func (s *grpcServer) Connect(stream api.SyncBackend_ConnectServer) error {
	l := zap.S()
	msg, err := stream.Recv()
	if err == io.EOF {
		return nil
	} else if err != nil {
		return err
	}
	var conn backend.Connection
	switch msg := msg.Msg.(type) {
	case *api.SyncBackendIncomingMessage_Connect:
		req := msg.Connect
		l = l.With("mapId", req.MapId, "connectionId", req.ConnectionId)
		l.Info("connecting")
		conn, err = s.Backend.Connect(req.MapId, req.Token, req.ConnectionId)
		if err != nil {
			l.Infow("failed to connect", zap.Error(err))
			return err
		}
		l.Info("connected")
	default:
		return fmt.Errorf("expected Connect message, got %T", msg)
	}
	defer func() {
		go conn.Close()
	}()

	go func() {
		for {
			select {
			case <-stream.Context().Done():
				return
			case msg, ok := <-conn.Outgoing():
				if !ok {
					return
				}

				data, err := json.Marshal(msg)
				if err != nil {
					zap.S().Errorw("failed to marshal outgoing message", zap.Error(err))
					return
				}

				err = stream.Send(&api.SyncBackendOutgoingMessage{
					Data: data,
				})
				if err != nil {
					zap.S().Infow("failed to send outgoing message", zap.Error(err))
					return
				}
			}
		}
	}()

	for {
		msg, err := stream.Recv()
		if err == io.EOF {
			return nil
		} else if err != nil {
			return err
		}
		switch msg := msg.Msg.(type) {
		case *api.SyncBackendIncomingMessage_Update:
			req := msg.Update
			l.Infow("received update", "seq", req.Seq)

			var aware schema.Aware
			if req.Aware != nil {
				err := json.Unmarshal(req.Aware, &aware)
				if err != nil {
					return fmt.Errorf("failed to unmarshal aware: %w", err)
				}
			}

			var change *schema.Changeset
			if req.Change != nil {
				err = json.Unmarshal(req.Change, &change)
				if err != nil {
					return fmt.Errorf("failed to unmarshal change: %w", err)
				}
			}

			err = conn.Receive(session.Incoming{
				Seq:    req.Seq,
				Aware:  aware,
				Change: change,
			})
			if err != nil {
				return fmt.Errorf("failed to receive: %w", err)
			}
		default:
			l.Info("ignoring message", "type", fmt.Sprintf("%T", msg))
		}
	}
}

func (s *grpcServer) Ping(ctx context.Context, _ *emptypb.Empty) (*emptypb.Empty, error) {
	return &emptypb.Empty{}, nil
}

func (s *grpcServer) Stats(ctx context.Context, _ *emptypb.Empty) (*structpb.Struct, error) {
	stats := s.Backend.Stats()
	resp, err := structpb.NewStruct(stats)
	if err != nil {
		zap.S().DPanic("failed to serialize stats to struct", zap.Error(err))
		return nil, err
	}
	return resp, nil
}

func (s *grpcServer) DebugState(ctx context.Context, _ *emptypb.Empty) (*wrapperspb.StringValue, error) {
	state := s.Backend.DebugState()
	return &wrapperspb.StringValue{Value: state}, nil
}
