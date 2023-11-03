package session

import (
	"context"
	"fmt"
	"sync/atomic"
	"time"

	schema "github.com/danielzfranklin/plantopo/api/sync_schema"
	"github.com/danielzfranklin/plantopo/sync_backend/internal/stores"
	"go.uber.org/zap"
)

type Connection struct {
	id   string
	sess *Session
	/* closed by session */
	outgoing chan Outgoing

	/* only session can read/write */
	seq int32
	/* only session can read/write */
	aware schema.Aware
}

type Incoming struct {
	connId string            // overwritten by Connection.Receive
	Seq    int32             `json:"seq"`
	Aware  schema.Aware      `json:"aware"`
	Change *schema.Changeset `json:"change"`
}

type Outgoing struct {
	Ack    *int32                   `json:"ack,omitempty"`
	Aware  *map[string]schema.Aware `json:"aware,omitempty"`
	Change *schema.Changeset        `json:"change,omitempty"`
	Error  error                    `json:"error,omitempty"`
}

type Repo interface {
	GetMapSnapshot(ctx context.Context, mapId string) (schema.Changeset, error)
	SetMapSnapshot(ctx context.Context, mapId string, value schema.Changeset) error
}

func (c *Connection) Close() {
	c.sess.closeConnChan <- c.id
}

func (c *Connection) Receive(input Incoming) error {
	input.connId = c.id

	if c.sess.failed.Load() {
		return fmt.Errorf("session failed")
	}

	timeout := time.NewTimer(1 * time.Second)
	defer timeout.Stop()

	select {
	case c.sess.receiveChan <- input:
		return nil
	case <-timeout.C:
		if c.sess.failed.Load() {
			return fmt.Errorf("session failed")
		}
		return fmt.Errorf("timeout sending to receiveChan")
	}
}

func (c *Connection) Outgoing() chan Outgoing {
	return c.outgoing
}

type Session struct {
	mapId          string
	failed         atomic.Bool
	ready          atomic.Bool
	connected      atomic.Int32
	lastDisconnect atomic.Int64
	connectChan    chan connectRequest
	receiveChan    chan Incoming
	closeConnChan  chan string
	closeChan      chan struct{}
}

type Config struct {
	Repo                     Repo
	saveInterval             Intervaler
	broadcastChangesInterval Intervaler
	broadcastAwareInterval   Intervaler
}

type connectRequest struct {
	id  string
	out chan *Connection
}

/*
New creates a New session.

Does not block.
*/
func New(c *Config, mapId string) *Session {
	if c.Repo == nil {
		panic("must specifiy SessionConfig.Repo")
	}
	if c.saveInterval == nil {
		c.saveInterval = Interval(time.Minute * 1)
	}
	if c.broadcastChangesInterval == nil {
		c.broadcastChangesInterval = Interval(time.Millisecond * 10)
	}
	if c.broadcastAwareInterval == nil {
		c.broadcastAwareInterval = Interval(time.Millisecond * 100)
	}

	sess := &Session{
		mapId:         mapId,
		connectChan:   make(chan connectRequest),
		receiveChan:   make(chan Incoming),
		closeConnChan: make(chan string),
		closeChan:     make(chan struct{}),
	}
	go sess.run(c)
	return sess
}

// Connect may block
func (s *Session) Connect(id string) (*Connection, error) {
	if s.failed.Load() {
		return nil, fmt.Errorf("session failed")
	}
	timeout := time.NewTimer(1 * time.Second)
	defer timeout.Stop()

	out := make(chan *Connection)
	select {
	case s.connectChan <- connectRequest{id, out}:
	case <-timeout.C:
		if s.failed.Load() {
			return nil, fmt.Errorf("session failed")
		} else {
			return nil, fmt.Errorf("timeout sending to connectChan")
		}
	}

	select {
	case conn := <-out:
		return conn, nil
	case <-timeout.C:
		if s.failed.Load() {
			return nil, fmt.Errorf("session failed")
		} else {
			return nil, fmt.Errorf("timeout receiving from connectChan")
		}
	}
}

// Close blocks until the session is done closing
func (s *Session) Close() error {
	timeout := time.NewTimer(1 * time.Second)
	defer timeout.Stop()
	select {
	case s.closeChan <- struct{}{}:
		return nil
	case <-timeout.C:
		return fmt.Errorf("timeout sending to closeChan")
	}
}

// Connected must not block
func (s *Session) Connected() int {
	return int(s.connected.Load())
}

// IsFailed must not block
func (s *Session) IsFailed() bool {
	return s.failed.Load()
}

// IsReady must not block
func (s *Session) IsReady() bool {
	return s.ready.Load()
}

// LastDisconnect must not block
func (s *Session) LastDisconnect() time.Time {
	return time.UnixMilli(s.lastDisconnect.Load())
}

func (s *Session) run(c *Config) {
	mapId := s.mapId
	l := zap.S().Named("sessionHandle.run").With("mapId", mapId)

	// fallible setup
	l.Infow("Setting up session")
	st, err := func() (*stores.Store, error) {
		loadCtx, cancel := context.WithTimeout(context.Background(), 1*time.Minute)
		defer cancel()
		snapshot, err := c.Repo.GetMapSnapshot(loadCtx, mapId)
		if err != nil {
			return nil, fmt.Errorf("failed to load snapshot: %w", err)
		}
		if snapshot.IsNil() {
			snapshot = schema.Changeset{}
		}
		l.Infow("creating store")
		st, err := stores.New(mapId, snapshot)
		if err != nil {
			return nil, fmt.Errorf("failed to create store: %w", err)
		}
		return st, nil
	}()
	if err != nil {
		l.Errorw("failed to setup session", zap.Error(err))
		s.failed.Store(true)
		return
	}
	l.Infow("set up session")

	conns := make(map[string]*Connection)
	unsent := schema.Changeset{}
	hasUnsaved := false
	savedFailed := make(chan struct{})

	bcastChangesTicker := c.broadcastChangesInterval.Ticker()
	defer bcastChangesTicker.Stop()
	bcastAwareTicker := c.broadcastAwareInterval.Ticker()
	defer bcastAwareTicker.Stop()
	saveTicker := c.saveInterval.Ticker()
	defer saveTicker.Stop()

	defer func() {
		l.Infow("closing session", "conns", len(conns))
		for _, conn := range conns {
			close(conn.outgoing)
		}

		connectedV := int(s.connected.Load())
		if connectedV != len(conns) {
			l.DPanic("connected count mismatch",
				"connected", connectedV, "conns", len(conns))
		}

		if hasUnsaved {
			l.Infow("doing final save")
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()
			err := c.Repo.SetMapSnapshot(ctx, s.mapId, st.Snapshot())
			if err != nil {
				l.Errorw("final save failed", zap.Error(err))
			}
		} else {
			l.Infow("no final save needed")
		}
	}()

	closeClient := func(conn *Connection) {
		close(conn.outgoing)
		delete(conns, conn.id)
		s.connected.Add(-1)
		now := time.Now().UnixMilli()
		s.lastDisconnect.Store(now)
	}

	dropClient := func(conn *Connection) {
		l.Infow("dropping client", "clientId", conn.id)
		closeClient(conn)
	}

	for {
		select {
		case <-s.closeChan:
			return
		case <-saveTicker.Chan():
			if !hasUnsaved {
				continue
			}
			l.Infow("saving")
			snapshot := st.Snapshot()
			hasUnsaved = false
			go func(snapshot schema.Changeset) {
				err := c.Repo.SetMapSnapshot(context.Background(), s.mapId, snapshot)
				if err != nil {
					l.Errorw("save failed", zap.Error(err))
					savedFailed <- struct{}{}
				}
			}(snapshot)
		case <-savedFailed:
			s.failed.Store(true)
			return
		case req := <-s.connectChan:
			l.Infow("connecting", "id", req.id)
			conn := &Connection{
				id:       req.id,
				sess:     s,
				outgoing: make(chan Outgoing, 8),
			}
			if prev, ok := conns[req.id]; ok {
				l.Infow("replacing conn", "id", req.id)
				close(prev.outgoing)

				conns[req.id] = conn
			} else {
				conns[req.id] = conn
				s.connected.Add(1)
			}
			snapshot := st.Snapshot()
			req.out <- conn

			msg := Outgoing{Change: &snapshot}
			select {
			case conn.outgoing <- msg:
			default:
				dropClient(conn)
			}
		case input := <-s.receiveChan:
			conn, ok := conns[input.connId]
			if !ok {
				l.Infow("receiveChan: unknown id", "unknownId", input.connId)
				continue
			}
			if input.Seq <= conn.seq {
				l.Infow("ignoring outdated receive", "seq", input.Seq)
				continue
			}

			conn.seq = input.Seq
			conn.aware = input.Aware

			if !input.Change.IsNil() {
				fixes, err := st.Update(l.Desugar(), input.Change)
				if err != nil {
					l.Infow("client sent invalid changeset",
						zap.Error(err), "value", input.Change)
					msg := Outgoing{
						Error: fmt.Errorf("invalid changeset: %w", err),
					}
					select {
					case conn.outgoing <- msg:
					default:
						dropClient(conn)
					}
					continue
				}

				hasUnsaved = true
				unsent.Merge(input.Change)
				if fixes != nil {
					unsent.Merge(fixes)
				}
			}
		case id := <-s.closeConnChan:
			if conn, ok := conns[id]; ok {
				l.Infow("closing conn", "id", id)
				closeClient(conn)
			} else {
				l.Infow("closeConnChan: unknown id")
			}
		case <-bcastChangesTicker.Chan():
			if unsent.IsNil() {
				continue
			}
			change := unsent.ShallowClone()
			unsent = schema.Changeset{}
			if err != nil {
				l.Panic("failed to marshal unsent", zap.Error(err))
			}
			for _, conn := range conns {
				ack := conn.seq
				msg := Outgoing{
					Ack:    &ack,
					Change: change,
				}
				select {
				case conn.outgoing <- msg:
				default:
					dropClient(conn)
				}
			}
		case <-bcastAwareTicker.Chan():
			aware := make(map[string]schema.Aware, len(conns))
			for _, conn := range conns {
				aware[conn.id] = conn.aware
			}
			for _, conn := range conns {
				ack := conn.seq
				msg := Outgoing{
					Ack:   &ack,
					Aware: &aware,
				}
				select {
				case conn.outgoing <- msg:
				default:
					dropClient(conn)
				}
			}
		}
	}
}
