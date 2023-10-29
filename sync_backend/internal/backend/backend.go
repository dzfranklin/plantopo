package backend

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/danielzfranklin/plantopo/sync_backend/internal/session"
	"go.uber.org/zap"
)

type Backend struct {
	mu               sync.Mutex
	shutdownSweepers func()
	pendingTokens    map[string]pendingToken     // by token
	sessions         map[string]*session.Session // by mapId
	*Config
}

type Connection interface {
	Receive(session.Incoming) error
	Outgoing() chan session.Outgoing
	Close()
}

type Matchmaker interface {
	RegisterClose(ctx context.Context, backend string, mapId string) error
}

type Config struct {
	ExternalAddr    string
	Matchmaker      Matchmaker
	Session         *session.Config
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
	if config.Session == nil {
		panic("config.Session required")
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
		sessions:      make(map[string]*session.Session),
		Config:        config,
	}

	b.startSweepers()

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

func (b *Backend) Connect(
	mapId string, token string, connectionId string,
) (Connection, error) {
	l := zap.S().Named("Backend.Connect").With("mapId", mapId)

	// Get or create a session while holding the lock.
	sess, err := func() (*session.Session, error) {
		b.mu.Lock()
		defer b.mu.Unlock()

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

		sess, ok := b.sessions[mapId]
		if !ok || sess.IsFailed() {
			l.Info("creating new session")
			sess = session.New(b.Session, mapId)
			b.sessions[mapId] = sess
		} else {
			l.Info("using existing session")
		}
		return sess, nil
	}()
	if err != nil {
		return nil, err
	}

	l.Info("connecting to session")
	conn, err := sess.Connect(connectionId)
	if err != nil {
		l.Infow("failed to connect", zap.Error(err))
		return nil, err
	}
	l.Info("connected to session")
	return conn, nil
}

func (b *Backend) Stats() map[string]interface{} {
	b.mu.Lock()
	defer b.mu.Unlock()

	stats := make(map[string]interface{})
	stats["pendingTokens"] = len(b.pendingTokens)
	stats["sessions"] = len(b.sessions)
	return stats
}

func (b *Backend) DebugState() string {
	b.mu.Lock()
	defer b.mu.Unlock()

	pending := make([]string, 0)
	for _, state := range b.pendingTokens {
		pending = append(pending, state.mapId)
	}

	sessions := make(map[string]map[string]interface{})
	for mapId, sess := range b.sessions {
		sessions[mapId] = map[string]interface{}{
			"isFailed":       sess.IsFailed(),
			"connectedCount": sess.Connected(),
		}
	}

	data := map[string]interface{}{
		"pending":  pending,
		"sessions": sessions,
	}
	return fmt.Sprintf("%#+v", data)
}

func (b *Backend) startSweepers() {
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

			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
			}

			b.sweepSessions()
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

func (b *Backend) sweepSessions() {
	b.mu.Lock()
	defer b.mu.Unlock()
	threshold := time.Now().Add(-b.emptySessionTTL)
	for mapId, sess := range b.sessions {
		// note that we don't see all failed sessions here as Connect replaces
		// failed sessions.
		isEmpty := sess.Connected() == 0 && sess.IsReady() && sess.LastDisconnect().Before(threshold)
		if sess.IsFailed() || isEmpty {
			delete(b.sessions, mapId)
			if isEmpty {
				zap.S().Infow("closing session with no connections", "mapId", mapId)
			}
			go func(mapId string, sess *session.Session) {
				err := sess.Close()
				if err != nil {
					zap.S().Warnw("failed to close session", "mapId", mapId, zap.Error(err))
				}

				ctx, cancel := context.WithTimeout(context.Background(), 1*time.Minute)
				defer cancel()
				err = b.Matchmaker.RegisterClose(ctx, b.ExternalAddr, mapId)
				if err != nil {
					zap.S().Warnw("failed to register close with matchmaker",
						"mapId", mapId, zap.Error(err))
				}
			}(mapId, sess)
		}
	}
}
