package backend

import (
	"context"
	"fmt"
	"github.com/danielzfranklin/plantopo/sync_backend/internal/docstore"
	"sync"
	"time"

	"go.uber.org/zap"
)

type Backend struct {
	mu               sync.Mutex
	shutdownSweepers func()
	pendingTokens    map[string]pendingToken // by token
	sessions         map[string]*docSession  // by mapId
	*Config
}

type Matchmaker interface {
	RegisterClose(ctx context.Context, backend string, mapId string) error
}

type Config struct {
	ExternalAddr    string
	Matchmaker      Matchmaker
	DocStore        docstore.Config
	sweepInterval   time.Duration
	pendingTTL      time.Duration
	emptySessionTTL time.Duration
}

func New(config *Config) *Backend {
	if config == nil {
		panic("config required")
	}
	if config.ExternalAddr == "" {
		panic("config.ExternalAddr required")
	}
	if config.Matchmaker == nil {
		panic("config.Matchmaker required")
	}
	if config.sweepInterval == 0 {
		config.sweepInterval = 5 * time.Second
	}
	if config.pendingTTL == 0 {
		config.pendingTTL = 5 * time.Minute
	}
	if config.emptySessionTTL == 0 {
		config.emptySessionTTL = 1 * time.Minute
	}

	b := &Backend{
		pendingTokens: make(map[string]pendingToken),
		sessions:      make(map[string]*docSession),
		Config:        config,
	}

	b.startSweeper()

	return b
}

type pendingToken struct {
	mapId      string
	insertedAt time.Time
}

func (b *Backend) SetupConnection(mapId string, token string) error {
	b.mu.Lock()
	defer b.mu.Unlock()

	l := zap.S().Named("Backend.SetupConnection").With("mapId", mapId)
	l.Info("setting up connection")

	if _, ok := b.pendingTokens[token]; ok {
		l.Warn("token already pending")
		return fmt.Errorf("token already pending")
	}
	b.pendingTokens[token] = pendingToken{
		mapId:      mapId,
		insertedAt: time.Now(),
	}
	return nil
}

func (b *Backend) Connect(mapId string, token string, clientId string) (*Session, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	l := zap.S().With("mapId", mapId)

	state, ok := b.pendingTokens[token]
	if !ok {
		l.Info("token not in pending")
		return nil, fmt.Errorf("invalid token")
	} else if state.insertedAt.Add(b.pendingTTL).Before(time.Now()) {
		l.Info("token expired")
		return nil, fmt.Errorf("invalid token")
	} else if state.mapId != mapId {
		l.Info("mapId mismatch")
		return nil, fmt.Errorf("invalid token")
	}
	delete(b.pendingTokens, token)

	ds, ok := b.sessions[mapId]
	if !ok {
		l.Info("creating new session")
		ds = newDocSession(mapId, b)
		b.sessions[mapId] = ds
	} else {
		if ds.isClosing() {
			l.Info("rejecting connect as session closing")
			return nil, fmt.Errorf("session closing, try again later")
		} else {
			l.Info("connecting to existing session")
		}
	}

	return ds.newSession(clientId)
}

func (b *Backend) shutdownSession(ds *docSession) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if len(ds.clients) > 0 {
		return
	}

	mapId := ds.mapId
	l := zap.S().With("mapId", mapId)

	l.Infow("closing doc session")

	go func() {
		err := ds.doc.Close()
		if err != nil {
			l.Errorw("failed to close docstore", zap.Error(err))
		}

		b.mu.Lock()
		delete(b.sessions, mapId)
		b.mu.Unlock()
		l.Infof("closed session for map %s", mapId)

		ctx, cancel := context.WithTimeout(context.Background(), 1*time.Minute)
		defer cancel()
		err = b.Matchmaker.RegisterClose(ctx, b.ExternalAddr, mapId)
		if err != nil {
			l.Warnw("failed to register close with matchmaker", "mapId", mapId, zap.Error(err))
		}
		l.Infof("registered close of map %s with matchmaker", mapId)
	}()
}

func (b *Backend) Stats() map[string]interface{} {
	b.mu.Lock()
	defer b.mu.Unlock()

	stats := make(map[string]interface{})
	stats["pendingTokens"] = len(b.pendingTokens)
	stats["sessions"] = len(b.sessions)
	return stats
}

func (b *Backend) Sessions() interface{} {
	b.mu.Lock()
	defer b.mu.Unlock()

	sessions := make(map[string][]string)
	for _, ds := range b.sessions {
		clients := make([]string, 0, len(ds.clients))
		for clientId := range ds.clients {
			clients = append(clients, clientId)
		}
		sessions[ds.mapId] = clients
	}
	return sessions
}

func (b *Backend) startSweeper() {
	b.mu.Lock()
	sweepInterval := b.sweepInterval
	ctx, cancel := context.WithCancel(context.Background())
	b.shutdownSweepers = cancel
	b.mu.Unlock()

	go func() {
		ticker := time.NewTicker(sweepInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
			}

			b.sweepPendingTokens()
		}
	}()
}

func (b *Backend) sweepPendingTokens() {
	b.mu.Lock()
	defer b.mu.Unlock()

	for token, state := range b.pendingTokens {
		if time.Since(state.insertedAt) > b.pendingTTL {
			zap.S().Infow("sweeping expired pending token", "token", token)
			delete(b.pendingTokens, token)
		}
	}
}
