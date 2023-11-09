package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/danielzfranklin/plantopo/sync_backend/internal/docstore"
	"go.uber.org/atomic"
	"io"

	schema "github.com/danielzfranklin/plantopo/api/sync_schema"
	api "github.com/danielzfranklin/plantopo/api/v1"
	"github.com/danielzfranklin/plantopo/sync_backend/internal/backend"
	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/structpb"
)

var _ api.SyncBackendServer = (*grpcServer)(nil)

type Backend interface {
	SetupConnection(mapId string, token string) error
	Connect(mapId string, token string, clientId string) (*backend.Session, error)
	Stats() map[string]interface{}
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
	_ context.Context, req *api.SyncBackendSetupConnectionRequest,
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
	var sess *backend.Session
	var clientId string
	switch msg := msg.Msg.(type) {
	case *api.SyncBackendIncomingMessage_Connect:
		req := msg.Connect
		clientId = req.ClientId
		l = l.With("mapId", req.MapId, "clientId", clientId)
		l.Info("connecting")
		sess, err = s.Backend.Connect(req.MapId, req.Token, clientId)
		if err != nil {
			return fmt.Errorf("failed to connect: %w", err)
		}
		l.Info("connected")
	default:
		return fmt.Errorf("expected Connect message, got %T", msg)
	}

	ack := atomic.NewInt32(0)
	as := sess.AwareStore()
	ds := sess.DocStore()

	defer func() {
		as.Delete(clientId)
		sess.Close()
	}()

	if err = ds.WaitForReady(); err != nil {
		return err
	}

	readerResult := make(chan error, 1)
	go func() {
		var err error
		defer func() {
			readerResult <- err
		}()

		for {
			var msg *api.SyncBackendIncomingMessage
			msg, err = stream.Recv()
			if err == io.EOF {
				err = nil
				return
			} else if err != nil {
				return
			}

			switch msg := msg.Msg.(type) {
			case *api.SyncBackendIncomingMessage_Update:
				req := msg.Update
				var aware *schema.Aware
				if req.Aware != nil {
					if err = json.Unmarshal(req.Aware, &aware); err != nil {
						return
					}
				}
				var change *schema.Changeset
				if req.Change != nil {
					if err = json.Unmarshal(req.Change, &change); err != nil {
						return
					}
				}

				if req.Seq != 0 {
					ack.Store(req.Seq)
				}

				if aware != nil {
					as.Put(clientId, *aware)
				}

				if change != nil {
					if err = ds.Update(change); err != nil {
						return
					}
				}
			default:
				l.Info("ignoring message", "type", fmt.Sprintf("%T", msg))
			}
		}
	}()

	writerResult := make(chan error, 1)
	go func() {
		awareChange := make(chan struct{}, 10)
		as.Subscribe(awareChange)
		docChange := make(chan uint64, 10)
		ds.Subscribe(docChange)
		defer func() {
			as.Unsubscribe(awareChange)
			ds.Unsubscribe(docChange)
			close(awareChange)
			close(docChange)
		}()

		lastGSent := uint64(0)

		var err error
		defer func() {
			writerResult <- err
		}()

		initialAValue := as.Get()
		var initialA []byte
		if initialA, err = json.Marshal(initialAValue); err != nil {
			return
		}
		initialG, initialDValue, err := ds.ChangesAfter(0)
		if err != nil {
			return
		}
		var initialD []byte
		if initialD, err = json.Marshal(initialDValue); err != nil {
			return
		}
		err = stream.Send(&api.SyncBackendOutgoingMessage{
			Aware:  initialA,
			Change: initialD,
		})
		if err != nil {
			return
		}
		lastGSent = initialG

		for {
			select {
			case <-stream.Context().Done():
				return
			case <-awareChange:
				value := as.Get()

				var data []byte
				if data, err = json.Marshal(value); err != nil {
					return
				}
				err = stream.Send(&api.SyncBackendOutgoingMessage{
					Ack:   ack.Load(),
					Aware: data,
				})
				if err != nil {
					return
				}
			case <-docChange:
				var nextG uint64
				var change *schema.Changeset
				if nextG, change, err = ds.ChangesAfter(lastGSent); err != nil {
					if errors.Is(err, docstore.ErrClosed) {
						err = nil
					}
					return
				}

				var data []byte
				if data, err = json.Marshal(change); err != nil {
					return
				}

				if err = stream.Send(&api.SyncBackendOutgoingMessage{
					Ack:    ack.Load(),
					Change: data,
				}); err != nil {
					return
				}

				lastGSent = nextG
			}
		}
	}()

	select {
	case err = <-readerResult:
	case err = <-writerResult:
	}
	return err
}

func (s *grpcServer) Stats(_ context.Context, _ *emptypb.Empty) (*structpb.Struct, error) {
	stats := s.Backend.Stats()
	resp, err := structpb.NewStruct(stats)
	if err != nil {
		zap.S().DPanic("failed to serialize stats to struct", zap.Error(err))
		return nil, err
	}
	return resp, nil
}
