package internal

import (
	"context"
	"fmt"
	"math/rand"
	"sync"

	"github.com/davecgh/go-spew/spew"
	"go.uber.org/zap"
)

type Matchmaker struct {
	mu        sync.Mutex
	rng       *rand.Rand
	backends  []*backendState
	byBackend map[string]*backendState
	byOpenMap map[string]*mapState
}

/*
Backend represents a backend we can communicate with.

It will not be called concurrently.
*/
type Backend interface {
	Id() string
	SetupConnection(ctx context.Context, mapId string, token string) error
}

func NewMatchmaker() *Matchmaker {
	return &Matchmaker{
		rng:       rand.New(rand.NewSource(rand.Int63())),
		backends:  make([]*backendState, 0),
		byBackend: make(map[string]*backendState),
		byOpenMap: make(map[string]*mapState),
	}
}

type backendState struct {
	open   map[string]struct{} // mapId
	handle Backend
}

type mapState struct {
	backend *backendState
}

func (m *Matchmaker) AddBackends(backends []Backend) {
	m.mu.Lock()
	defer m.mu.Unlock()
	l := zap.S().Named("Matchmaker.AddBackends")
	for _, backend := range backends {
		id := backend.Id()
		l.Infow("adding", "id", id)
		if m.byBackend[id] != nil {
			continue
		}

		state := &backendState{
			open:   make(map[string]struct{}),
			handle: backend,
		}
		m.backends = append(m.backends, state)
		m.byBackend[id] = state
	}
}

func (m *Matchmaker) RemoveBackends(backends []string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	l := zap.S().Named("Matchmaker.RemoveBackends")
	for _, backend := range backends {
		l.Infow("removing", "id", backend)
		backendState := m.byBackend[backend]
		if backendState == nil {
			l.Infow("skipping nonexistent", "id", backend)
			continue
		}
		delete(m.byBackend, backend)
		for mapId := range backendState.open {
			delete(m.byOpenMap, mapId)
		}
	}
	m.backends = make([]*backendState, 0, len(m.byBackend))
	for _, backend := range m.byBackend {
		m.backends = append(m.backends, backend)
	}
}

type Connection struct {
	Backend string
	Token   string
}

func (m *Matchmaker) SetupConnection(ctx context.Context, mapId string) (Connection, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	l := zap.S().Named("Matchmaker.SetupConnection").With("mapId", mapId)
	l.Infow("setting up connection")
	token := genToken()
	existing := m.byOpenMap[mapId]

	if existing == nil {
		if len(m.backends) == 0 {
			err := fmt.Errorf("no backends")
			l.Warn("no backends")
			return Connection{}, err
		}
		pick := m.rng.Intn(len(m.backends))
		backend := m.backends[pick]

		err := backend.handle.SetupConnection(ctx, mapId, token)
		if err != nil {
			err := fmt.Errorf("failed to setup connection to new: %w", err)
			l.Infow("failed to setup new connection", zap.Error(err))
			return Connection{}, err
		}

		m.byOpenMap[mapId] = &mapState{backend}
		backend.open[mapId] = struct{}{}

		l.Infow("setup new connection", "backend", backend.handle.Id())
		return Connection{Backend: backend.handle.Id(), Token: token}, nil
	} else {
		backend := existing.backend

		err := backend.handle.SetupConnection(ctx, mapId, token)
		if err != nil {
			delete(backend.open, mapId)
			delete(m.byOpenMap, mapId)

			err := fmt.Errorf(
				"failed to setup connection to existing (backend %s): %w",
				backend.handle.Id(), err)
			l.Infow("failed to setup connection to existing",
				"mapId", mapId, "backend", backend.handle.Id(), "error", err)
			return Connection{}, err
		}

		l.Infow("setup connection to existing", "backend", backend.handle.Id())
		return Connection{Backend: backend.handle.Id(), Token: token}, nil
	}
}

func (m *Matchmaker) RegisterClose(backendId string, mapId string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	l := zap.S().Named("Matchmaker.RegisterClose").With(
		"mapId", mapId, "backend", backendId)
	l.Infow("registering close")

	backend := m.byBackend[backendId]
	if backend == nil {
		l.Warn("backend not found")
		return
	}

	delete(backend.open, mapId)
	delete(m.byOpenMap, mapId)
}

func (m *Matchmaker) Stats() map[string]interface{} {
	m.mu.Lock()
	defer m.mu.Unlock()

	return map[string]interface{}{
		"backends": len(m.backends),
		"openMaps": len(m.byOpenMap),
	}
}

func (m *Matchmaker) DebugState() string {
	m.mu.Lock()
	defer m.mu.Unlock()

	byOpenMap := make(map[string]string, len(m.byOpenMap))
	for mapId, state := range m.byOpenMap {
		byOpenMap[mapId] = state.backend.handle.Id()
	}

	byBackend := make(map[string][]string, len(m.byBackend))
	for id, state := range m.byBackend {
		open := make([]string, 0, len(state.open))
		for mapId := range state.open {
			open = append(open, mapId)
		}
		byBackend[id] = open
	}

	return spew.Sdump(map[string]interface{}{
		"byOpenMap": byOpenMap,
		"byBackend": byBackend,
	})
}
