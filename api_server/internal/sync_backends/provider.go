package sync_backends

import (
	api "github.com/danielzfranklin/plantopo/api/v1"
	cmap "github.com/orcaman/concurrent-map/v2"
	"google.golang.org/grpc"
)

type Provider struct {
	cache cmap.ConcurrentMap[string, api.SyncBackendClient]
	*Config
}

type Config struct {
	DialOpts []grpc.DialOption
}

func NewProvider(config *Config) *Provider {
	return &Provider{
		cache:  cmap.New[api.SyncBackendClient](),
		Config: config,
	}
}

func (p *Provider) Dial(backend string) (api.SyncBackendClient, error) {
	value, ok := p.cache.Get(backend)
	if ok {
		return value, nil
	}

	cc, err := grpc.Dial(backend, p.DialOpts...)
	if err != nil {
		return nil, err
	}
	b := api.NewSyncBackendClient(cc)

	p.cache.Set(backend, b)
	return b, nil
}
