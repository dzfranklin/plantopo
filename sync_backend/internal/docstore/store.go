package docstore

import (
	"context"
	"errors"
	schema "github.com/danielzfranklin/plantopo/api/sync_schema"
	"github.com/danielzfranklin/plantopo/sync_backend/internal/doclog"
	"go.uber.org/zap"
	"sync"
	"time"
)

var ErrNotReady = errors.New("docstore: not ready")
var ErrFatal = errors.New("docstore: fatal error")
var ErrClosed = errors.New("docstore: closed")

const (
	notReadyStatus = iota
	readyStatus
	errorStatus
	closedStatus
)

type Store struct {
	// not protected by mutex, only modified during initialization
	mapId string
	c     Config
	l     *zap.SugaredLogger

	mu sync.RWMutex

	lastSaveG    uint64
	stopSaveLoop chan chan struct{}

	status       int
	readyWaiters []chan struct{}
	doc          *docState
	dl           DocLogger
	subscribers  map[chan uint64]struct{}
}

type Config struct {
	Logger *zap.Logger

	Loader func(ctx context.Context, mapId string) (DocLogger, error)

	LoadTimeout  time.Duration
	SaveTimeout  time.Duration
	SaveInterval time.Duration
}

type DocLogger interface {
	Len() int
	Get() []*doclog.Entry
	Push(ctx context.Context, entry *doclog.Entry) error
	Replace(ctx context.Context, entry *doclog.Entry) error
}

func New(mapId string, c Config) *Store {
	if c.Logger == nil {
		c.Logger = zap.NewNop()
	}
	if c.LoadTimeout == 0 {
		c.LoadTimeout = 60 * time.Second
	}
	if c.SaveTimeout == 0 {
		c.SaveTimeout = 5 * time.Minute
	}
	if c.SaveInterval == 0 {
		c.SaveInterval = 60 * time.Second
	}

	s := &Store{
		mapId: mapId,
		c:     c,
		l:     c.Logger.Sugar(),

		stopSaveLoop: make(chan chan struct{}, 1),
		status:       notReadyStatus,
		subscribers:  make(map[chan uint64]struct{}),
	}
	go s.load()
	return s
}

func (s *Store) Close() error {
	s.mu.Lock()
	if err := errForStatus(s.status); err != nil {
		s.mu.Unlock()
		return err
	}
	s.status = closedStatus
	for _, c := range s.readyWaiters {
		close(c)
	}
	s.mu.Unlock()

	out := make(chan struct{}, 1)
	s.stopSaveLoop <- out
	<-out

	err := s.save()
	return err
}

func (s *Store) WaitForReady() error {
	s.mu.Lock()
	if s.status != notReadyStatus {
		res := errForStatus(s.status)
		s.mu.Unlock()
		return res
	}
	c := make(chan struct{}, 1)
	s.readyWaiters = append(s.readyWaiters, c)
	s.mu.Unlock()

	<-c

	s.mu.Lock()
	status := s.status
	s.mu.Unlock()
	return errForStatus(status)
}

func (s *Store) load() {
	ctx, cancel := context.WithTimeout(context.Background(), s.c.LoadTimeout)
	defer cancel()

	var err error
	defer func() {
		if err != nil {
			s.l.Errorw("load failed", zap.Error(err))
			s.mu.Lock()
			s.status = errorStatus
			for _, c := range s.readyWaiters {
				close(c)
			}
			s.readyWaiters = nil
			s.mu.Unlock()
		}
	}()

	var dl DocLogger
	if dl, err = s.c.Loader(ctx, s.mapId); err != nil {
		return
	}

	doc := newDocState(s.l.Desugar(), 0)
	lastSaveG := uint64(0)
	entries := dl.Get()
	if len(entries) > 0 {
		earliest := entries[0]
		latest := entries[len(entries)-1]

		lastSaveG = latest.GenerationEnd

		doc.FastForward(earliest.GenerationStart - 1)
		for _, entry := range entries {
			_, err = doc.Update(entry.Changeset)
			if err != nil {
				return
			}
			doc.FastForward(entry.GenerationEnd)
		}
	}

	go s.saveLoop()

	s.mu.Lock()
	s.dl = dl
	s.doc = doc
	s.lastSaveG = lastSaveG
	s.status = readyStatus
	for _, c := range s.readyWaiters {
		close(c)
	}
	s.readyWaiters = nil
	s.mu.Unlock()
}

func (s *Store) saveLoop() {
	ticker := time.NewTicker(s.c.SaveInterval)
	defer ticker.Stop()
	for {
		select {
		case out := <-s.stopSaveLoop:
			out <- struct{}{}
			return
		case <-ticker.C:
			err := s.save()
			if err != nil {
				s.l.Errorw("saveLoop failed to save doc", zap.Error(err))
				s.mu.Lock()
				s.status = errorStatus
				s.mu.Unlock()
			}
		}
	}
}

func (s *Store) save() error {
	s.mu.RLock()
	lastSaveG := s.lastSaveG
	s.mu.RUnlock()

	ctx, cancel := context.WithTimeout(context.Background(), s.c.SaveTimeout)
	defer cancel()

	gEnd, changes := s.doc.ChangesAfter(lastSaveG)

	if changes == nil {
		return nil
	}

	entry := &doclog.Entry{
		GenerationStart: lastSaveG + 1,
		GenerationEnd:   gEnd,
		Changeset:       changes,
	}

	var err error
	if s.dl.Len() > 50 {
		err = s.dl.Replace(ctx, entry)
	} else {
		err = s.dl.Push(ctx, entry)
	}
	if err != nil {
		s.l.Errorw("failed to save doc", zap.Error(err))
		return err
	}

	s.mu.Lock()
	s.lastSaveG = gEnd
	s.mu.Unlock()

	return nil
}

// Subscribe registers a channel to receive updates when the document changes.
//
// The channel will be sent the new generation number after the update on a best-effort basis.
func (s *Store) Subscribe(c chan uint64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.subscribers[c] = struct{}{}
}

func (s *Store) Unsubscribe(c chan uint64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.subscribers, c)
}

func (s *Store) Update(c *schema.Changeset) error {
	s.mu.RLock()
	status := s.status
	s.mu.RUnlock()
	if err := errForStatus(status); err != nil {
		return err
	}

	g, err := s.doc.Update(c)
	if err != nil {
		return err
	}

	s.mu.RLock()
	for c := range s.subscribers {
		select {
		case c <- g:
		default:
		}
	}
	s.mu.RUnlock()

	return nil
}

func (s *Store) ChangesAfter(g uint64) (uint64, *schema.Changeset, error) {
	s.mu.RLock()
	status := s.status
	s.mu.RUnlock()
	if err := errForStatus(status); err != nil {
		return 0, nil, err
	}

	latestG, change := s.doc.ChangesAfter(g)
	return latestG, change, nil
}

func errForStatus(status int) error {
	switch status {
	case notReadyStatus:
		return ErrNotReady
	case errorStatus:
		return ErrFatal
	case closedStatus:
		return ErrClosed
	case readyStatus:
		return nil
	}
	panic("unreachable")
}
