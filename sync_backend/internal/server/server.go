package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	signerv4 "github.com/aws/aws-sdk-go-v2/aws/signer/v4"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/danielzfranklin/plantopo/sync_backend/internal/converter"
	"github.com/danielzfranklin/plantopo/sync_backend/internal/docstore"
	"github.com/oklog/ulid/v2"
	"go.uber.org/atomic"
	"google.golang.org/grpc/status"
	"io"
	"net/http"
	"time"

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
	Backend      Backend
	S3           S3
	ExportBucket string
}

type grpcServer struct {
	api.UnimplementedSyncBackendServer
	*Config
	importFetcher *http.Client
}

func NewGRPCServer(config *Config) (*grpc.Server, error) {
	gsrv := grpc.NewServer()
	reflection.Register(gsrv)
	srv := newGrpcServer(config)
	api.RegisterSyncBackendServer(gsrv, srv)
	return gsrv, nil
}

func newGrpcServer(config *Config) *grpcServer {
	return &grpcServer{Config: config, importFetcher: &http.Client{}}
}

type S3 interface {
	PresignGetObject(context.Context, *s3.GetObjectInput, ...func(*s3.PresignOptions)) (*signerv4.PresignedHTTPRequest, error)
	PutObject(context.Context, *s3.PutObjectInput, ...func(*s3.Options)) (*s3.PutObjectOutput, error)
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

func (s *grpcServer) Export(ctx context.Context, req *api.SyncBackendExportRequest) (*api.SyncBackendExportResponse, error) {
	logger := zap.L().With(
		zap.String("mapId", req.Connect.MapId),
		zap.String("clientId", req.Connect.ClientId))

	sess, err := s.Backend.Connect(req.Connect.MapId, req.Connect.Token, req.Connect.ClientId)
	if err != nil {
		return nil, fmt.Errorf("failed to connect: %w", err)
	}

	_, cset, err := sess.DocStore().ChangesAfter(0)
	if err != nil {
		return nil, err
	}
	if cset == nil {
		cset = &schema.Changeset{}
	}

	converted, err := converter.ConvertFromChangeset(logger, req.Format, req.Name, *cset)
	if err != nil {
		if errors.Is(err, converter.UnknownFormatError) {
			return nil, status.Error(400, err.Error())
		}
		return nil, err
	}

	key := fmt.Sprintf("sync-backend-export/%s/%s", ulid.Make().String(), req.Filename)

	_, err = s.S3.PutObject(ctx, &s3.PutObjectInput{
		Bucket: &s.ExportBucket,
		Key:    &key,
		Body:   bytes.NewReader(converted),
	})
	if err != nil {
		return nil, err
	}

	presign, err := s.S3.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: &s.ExportBucket,
		Key:    &key,
	}, func(options *s3.PresignOptions) {
		options.Expires = 15 * time.Minute
	})
	if err != nil {
		return nil, err
	}

	return &api.SyncBackendExportResponse{Url: presign.URL}, nil
}

func (s *grpcServer) Import(ctx context.Context, req *api.SyncBackendImportRequest) (*api.SyncBackendImportResponse, error) {
	logger := zap.L().With(
		zap.String("mapId", req.Connect.MapId),
		zap.String("clientId", req.Connect.ClientId),
		zap.String("importId", req.ImportId))

	fetchReq, err := http.NewRequestWithContext(ctx, "GET", req.Url, nil)
	if err != nil {
		return nil, err
	}
	fetch, err := s.importFetcher.Do(fetchReq)
	if err != nil {
		return nil, err
	}
	defer fetch.Body.Close()

	cset, err := converter.ConvertToChangeset(logger, req.Format, req.ImportId, req.ImportedFromFilename, fetch.Body)
	if err != nil {
		if errors.Is(err, converter.UnknownFormatError) {
			return nil, status.Error(400, err.Error())
		}
		return nil, err
	}

	sess, err := s.Backend.Connect(req.Connect.MapId, req.Connect.Token, req.Connect.ClientId)
	if err != nil {
		return nil, err
	}

	err = sess.DocStore().Update(cset)
	if err != nil {
		return nil, err
	}

	return &api.SyncBackendImportResponse{}, nil
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
