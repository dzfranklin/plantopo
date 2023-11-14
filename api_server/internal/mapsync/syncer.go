package mapsync

import (
	"context"
	"fmt"
	"github.com/cenkalti/backoff/v4"
	api "github.com/danielzfranklin/plantopo/api/v1"
	"github.com/oklog/ulid/v2"
	cmap "github.com/orcaman/concurrent-map/v2"
	"google.golang.org/grpc"
	"time"
)

type Syncer struct {
	matchmaker   api.MatchmakerClient
	backendCache cmap.ConcurrentMap[string, api.SyncBackendClient]
	dialOpts     []grpc.DialOption
}

type preConn struct {
	mapId    string
	clientId string
	setup    *api.MatchmakerSetupConnectionResponse
	backend  api.SyncBackendClient
}

func NewSyncer(matchmakerTarget string, dialOpts []grpc.DialOption) (*Syncer, error) {
	matchCC, err := grpc.Dial(matchmakerTarget, dialOpts...)
	if err != nil {
		return nil, fmt.Errorf("failed to dial matchmaker: %w", err)
	}
	matchmaker := api.NewMatchmakerClient(matchCC)
	return &Syncer{
		matchmaker:   matchmaker,
		backendCache: cmap.New[api.SyncBackendClient](),
		dialOpts:     dialOpts,
	}, nil
}

// Connect setups up and returns a Connection.
//
// ctx is only used for the setup phase.
func (s *Syncer) Connect(ctx context.Context, clientId string, mapId string) (*Connection, error) {
	var conn *Connection
	err := s.withRetries(func() (err error) {
		conn, err = s.connectOnce(ctx, clientId, mapId)
		return
	})
	return conn, err
}

func (s *Syncer) connectOnce(ctx context.Context, clientId string, mapId string) (*Connection, error) {
	c := preConn{mapId: mapId, clientId: clientId}
	if err := s.setup(ctx, &c); err != nil {
		return nil, err
	}
	return connect(c)
}

type ImportInfo struct {
	URL                  string
	Format               string
	ImportId             string
	ImportedFromFilename string
}

// Import imports a changeset into the map.
func (s *Syncer) Import(ctx context.Context, mapId string, info ImportInfo) error {
	return s.withRetries(func() error {
		return s.importOnce(ctx, mapId, info)
	})
}

func (s *Syncer) importOnce(ctx context.Context, mapId string, info ImportInfo) error {
	c := internalClient(mapId)
	if err := s.setup(ctx, &c); err != nil {
		return err
	}
	_, err := c.backend.Import(ctx, &api.SyncBackendImportRequest{
		Connect:              c.toRequest(),
		Url:                  info.URL,
		Format:               info.Format,
		ImportId:             info.ImportId,
		ImportedFromFilename: info.ImportedFromFilename,
	})
	return err
}

type ExportInfo struct {
	Name     string
	Filename string
	Format   string
}

// Export returns a URL to download the export.
func (s *Syncer) Export(ctx context.Context, mapId string, info ExportInfo) (string, error) {
	var url string
	err := s.withRetries(func() (err error) {
		url, err = s.exportOnce(ctx, mapId, info)
		return
	})
	return url, err
}

func (s *Syncer) exportOnce(ctx context.Context, mapId string, info ExportInfo) (string, error) {
	c := internalClient(mapId)
	if err := s.setup(ctx, &c); err != nil {
		return "", err
	}
	resp, err := c.backend.Export(ctx, &api.SyncBackendExportRequest{
		Connect:  c.toRequest(),
		Format:   info.Format,
		Name:     info.Name,
		Filename: info.Filename,
	})
	if err != nil {
		return "", err
	}
	return resp.Url, nil
}

func (s *Syncer) setup(ctx context.Context, c *preConn) error {
	setup, err := s.matchmaker.SetupConnection(ctx, &api.MatchmakerSetupConnectionRequest{MapId: c.mapId})
	if err != nil {
		return fmt.Errorf("failed to setup connection: %w", err)
	}
	c.setup = setup

	b, err := s.dialBackend(ctx, setup.Backend)
	if err != nil {
		return fmt.Errorf("failed to dial backend: %w", err)
	}
	c.backend = b

	return nil
}

func (s *Syncer) dialBackend(ctx context.Context, target string) (api.SyncBackendClient, error) {
	value, ok := s.backendCache.Get(target)
	if ok {
		return value, nil
	}

	cc, err := grpc.DialContext(ctx, target, s.dialOpts...)
	if err != nil {
		return nil, err
	}
	b := api.NewSyncBackendClient(cc)

	s.backendCache.SetIfAbsent(target, b)
	return b, nil
}

func internalClient(mapId string) preConn {
	return preConn{
		mapId:    mapId,
		clientId: fmt.Sprintf("internal-%s", ulid.Make().String()),
	}
}

func (p preConn) toRequest() *api.SyncBackendConnectRequest {
	return &api.SyncBackendConnectRequest{
		MapId:    p.mapId,
		Token:    p.setup.Token,
		ClientId: p.clientId,
	}
}

func (s *Syncer) withRetries(op backoff.Operation) error {
	b := backoff.NewExponentialBackOff()
	b.InitialInterval = 100 * time.Millisecond
	return backoff.Retry(op, backoff.WithMaxRetries(b, 5))
}
