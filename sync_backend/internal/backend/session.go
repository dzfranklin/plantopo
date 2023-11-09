package backend

import (
	"fmt"
	"github.com/danielzfranklin/plantopo/sync_backend/internal/awarestore"
	"github.com/danielzfranklin/plantopo/sync_backend/internal/docstore"
	"sync"
)

type docSession struct {
	mapId string
	b     *Backend
	doc   *docstore.Store
	aware *awarestore.Store

	mu      sync.Mutex
	clients map[string]*Session
	closing bool
}

func (ds *docSession) isClosing() bool {
	ds.mu.Lock()
	defer ds.mu.Unlock()
	return ds.closing
}

type Session struct {
	ds       *docSession
	clientId string
}

func newDocSession(mapId string, b *Backend) *docSession {
	return &docSession{
		mapId:   mapId,
		b:       b,
		doc:     docstore.New(mapId, b.DocStore),
		aware:   awarestore.New(),
		clients: make(map[string]*Session),
	}
}

func (ds *docSession) newSession(clientId string) (*Session, error) {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	if _, ok := ds.clients[clientId]; ok {
		return nil, fmt.Errorf("client %q already exists", clientId)
	}

	s := &Session{
		ds:       ds,
		clientId: clientId,
	}
	ds.clients[clientId] = s
	return s, nil
}

func (s *Session) Close() {
	s.ds.mu.Lock()
	delete(s.ds.clients, s.clientId)
	remaining := len(s.ds.clients)
	s.ds.mu.Unlock()

	if remaining == 0 {
		s.ds.mu.Lock()
		s.ds.closing = true
		s.ds.mu.Unlock()

		s.ds.b.shutdownSession(s.ds)
	}
}

func (s *Session) AwareStore() *awarestore.Store {
	return s.ds.aware
}

func (s *Session) DocStore() *docstore.Store {
	return s.ds.doc
}
