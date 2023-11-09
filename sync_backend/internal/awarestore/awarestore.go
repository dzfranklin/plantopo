package awarestore

import (
	schema "github.com/danielzfranklin/plantopo/api/sync_schema"
	"sync"
)

type Store struct {
	mu sync.RWMutex

	data        map[string]schema.Aware
	subscribers map[chan struct{}]struct{}
}

func New() *Store {
	return &Store{
		data:        make(map[string]schema.Aware),
		subscribers: make(map[chan struct{}]struct{}),
	}
}

func (s *Store) Subscribe(c chan struct{}) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.subscribers[c] = struct{}{}
}

func (s *Store) Unsubscribe(c chan struct{}) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.subscribers, c)
}

func (s *Store) Put(clientId string, value schema.Aware) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data[clientId] = value
	for c := range s.subscribers {
		select {
		case c <- struct{}{}:
		default:
		}
	}
}

func (s *Store) Delete(clientId string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.data, clientId)
	for c := range s.subscribers {
		select {
		case c <- struct{}{}:
		default:
		}
	}
}

func (s *Store) Get() []schema.Aware {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var result []schema.Aware
	for _, v := range s.data {
		result = append(result, v)
	}
	return result
}
