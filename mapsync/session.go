package mapsync

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/danielzfranklin/plantopo/logger"
	"github.com/danielzfranklin/plantopo/mapsync/store"
	schema "github.com/danielzfranklin/plantopo/sync_schema"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type IncomingSessionMsg struct {
	// per client, strictly increasing
	Seq    int32             `json:"seq,omitempty"`
	From   uuid.UUID         `json:"from,omitempty"`
	Aware  *schema.Aware     `json:"aware,omitempty"`
	Change *schema.Changeset `json:"change,omitempty"`
}

type OutgoingSessionMsg struct {
	// latest client seq received
	Acks   *map[uuid.UUID]int32        `json:"acks,omitempty"`
	Aware  *map[uuid.UUID]schema.Aware `json:"aware,omitempty"`
	Change *schema.Changeset           `json:"change,omitempty"`
	Error  error                       `json:"error,omitempty"`
}

type ErrOldSeq struct{}

func (e *ErrOldSeq) Error() string {
	return "old seq"
}

type connectRequest struct {
	mapId    uuid.UUID // needed for matchmaker
	clientId uuid.UUID // random, identifies specific request
	outgoing chan OutgoingSessionMsg
	ok       chan Connection
	err      chan error // used by matchmaker
}

type session struct {
	connect chan *connectRequest
}

func newSession(
	ctx context.Context,
	c Config,
	notifyClosed chan uuid.UUID,
	mapId uuid.UUID,
) (session, error) {
	l := logger.FromCtx(ctx).Named("newSession").With(zap.String("mapId", mapId.String()))

	l.Info("loading store")
	store, err := store.Load(ctx, c.Repo, mapId)
	if err != nil {
		return session{}, err
	}
	l.Info("loaded store")

	connect := make(chan *connectRequest)
	go handler(
		ctx,
		c,
		notifyClosed,
		store,
		mapId,
		connect,
	)
	return session{connect}, nil
}

type client struct {
	out   chan OutgoingSessionMsg
	seq   *int32
	aware schema.Aware
}

func handler(
	ctx context.Context,
	c Config,
	notifyClosed chan uuid.UUID,
	store *store.Store,
	mapId uuid.UUID,
	connectChan chan *connectRequest,
) {
	if c.Session.EmptyTimeout == 0 {
		c.Session.EmptyTimeout = time.Minute * 5
	}
	if c.Session.SaveInterval == 0 {
		c.Session.SaveInterval = time.Minute * 1
	}
	if c.Session.BroadcastInterval == 0 {
		c.Session.BroadcastInterval = time.Millisecond * 10
	}

	l := logger.FromCtx(ctx).Named("sessionHandler").With(zap.String("mapId", mapId.String()))
	ctx = logger.WithCtx(ctx, l)
	l.Info("session starting")

	defer func() {
		l.Info("notifying closed")
		notifyClosed <- mapId
		l.Info("session closed")
	}()

	incoming := make(chan IncomingSessionMsg)
	clientDisconnects := make(chan uuid.UUID)
	clients := make(map[uuid.UUID]*client)
	var unsent *schema.Changeset
	saveError := make(chan error)
	trafficLog := maybeOpenTrafficLog(l, c, mapId)

	defer func() {
		l.Info("session closing")
		for _, client := range clients {
			close(client.out)
		}
		store.Save(context.Background())
		trafficLog.maybeClose(l)
	}()

	go func() {
		time.Sleep(c.Session.SaveInterval)
		err := store.Save(context.Background())
		if err != nil {
			saveError <- err
		}
	}()

	emptyTimeout := time.After(c.Session.EmptyTimeout)
	broadcastTimeout := time.After(c.Session.BroadcastInterval)
	l.Info("session started")
	for {
		select {
		case <-ctx.Done():
			return
		case clientId := <-clientDisconnects:
			delete(clients, clientId)
		case <-emptyTimeout:
			if len(clients) == 0 {
				return
			} else {
				emptyTimeout = time.After(c.Session.EmptyTimeout)
			}
		case err := <-saveError:
			l.Error("disconnecting for save error", zap.Error(err))
			err = fmt.Errorf("cannot save: %w", err)
			for _, client := range clients {
				client.out <- OutgoingSessionMsg{Error: err}
			}
			return
		case <-broadcastTimeout:
			// NOTE: We may want to reduce the interval if there are no changes
			acks := make(map[uuid.UUID]int32, len(clients))
			for clientId, client := range clients {
				if client.seq != nil {
					acks[clientId] = *client.seq
				}
			}
			msg := OutgoingSessionMsg{
				Acks:   &acks,
				Aware:  makeAwareMap(clients),
				Change: unsent,
			}
			trafficLog.maybeWriteBroadcast(l, msg)
			for _, client := range clients {
				client.out <- msg
			}
			l.Debug("sent bcast")
			unsent = nil
			broadcastTimeout = time.After(c.Session.BroadcastInterval)
		case req := <-connectChan:
			if req.mapId != mapId {
				l.DPanic("connect request sent to wrong session", zap.String("requestMapId", req.mapId.String()))
				continue
			} else if _, ok := clients[req.clientId]; ok {
				l.DPanic("duplicate clientId", zap.String("clientId", req.clientId.String()))
				continue
			}

			l := l.With(zap.String("clientId", req.clientId.String()))
			client := &client{
				out: req.outgoing,
				aware: schema.Aware{
					ClientId: req.clientId,
				},
			}
			clients[req.clientId] = client

			req.ok <- Connection{
				ClientId: req.clientId,
				Incoming: incoming,
				Disconnect: func() {
					clientDisconnects <- req.clientId
				},
			}
			l.Info("connected")

			snapshot := store.ToSnapshot()
			client.out <- OutgoingSessionMsg{
				Aware:  makeAwareMap(clients),
				Change: &snapshot,
			}
			l.Info("sent welcome")

		case inMsg := <-incoming:
			if inMsg.From == uuid.Nil {
				l.DPanic("bug: incoming message has no IncomingFrom")
				continue
			}
			client, ok := clients[inMsg.From]
			if !ok {
				l.DPanic("bug: incoming message without client")
				continue
			}
			l := l.With(zap.String("clientId", inMsg.From.String()))
			l.Debug("received message")
			trafficLog.maybeWriteIncoming(l, inMsg)

			if client.seq != nil && inMsg.Seq <= *client.seq {
				l.Info("client sent old seq",
					zap.Int32("sent", inMsg.Seq), zap.Int32("last", *client.seq))
				replyMsg := OutgoingSessionMsg{Error: &ErrOldSeq{}}
				trafficLog.maybeWriteReply(l, inMsg.From, replyMsg)
				client.out <- replyMsg
				continue
			}
			client.seq = &inMsg.Seq

			if inMsg.Aware != nil {
				client.aware = *inMsg.Aware
				client.aware.ClientId = inMsg.From
				l.Debug("updated aware")
			}

			if inMsg.Change != nil {
				fixes, err := store.Update(l, inMsg.Change)
				if err != nil {
					l.Info("client sent unfixable changeset",
						zap.Error(err), zap.Any("inMsg", inMsg))
					replyMsg := OutgoingSessionMsg{Error: err}
					trafficLog.maybeWriteReply(l, inMsg.From, replyMsg)
					client.out <- replyMsg
					continue
				} else if fixes != nil {
					replyMsg := OutgoingSessionMsg{Change: fixes}
					trafficLog.maybeWriteReply(l, inMsg.From, replyMsg)
					l.Info("replying with fixes")
					client.out <- replyMsg
				}

				if unsent == nil {
					unsent = &schema.Changeset{}
				}
				unsent.Merge(inMsg.Change)
				unsent.Merge(fixes)
			}
		}
	}
}

func makeAwareMap(clients map[uuid.UUID]*client) *map[uuid.UUID]schema.Aware {
	out := make(map[uuid.UUID]schema.Aware, len(clients))
	for _, client := range clients {
		out[client.aware.ClientId] = client.aware
	}
	return &out
}

// not for concurrent access
type trafficLog os.File

type trafficLogEntry struct {
	Incoming IncomingSessionMsg

	Bcast OutgoingSessionMsg

	ReplyTo uuid.UUID
	Reply   OutgoingSessionMsg
}

func maybeOpenTrafficLog(l *zap.Logger, c Config, mapId uuid.UUID) *trafficLog {
	if !c.Session.LogTraffic {
		return nil
	}
	now := time.Now()
	dirname := fmt.Sprintf("traffic/%s_%s_%s",
		c.Host, now.Format(time.DateOnly), c.RunId.String())
	dir := filepath.Join(os.TempDir(), dirname)
	if err := os.MkdirAll(dir, 0755); err != nil {
		l.DPanic("failed to create temp dir", zap.Error(err))
		return nil
	}
	fname := fmt.Sprintf("%s_%s.log", mapId.String(), now.Format("15:04:05:00"))
	fpath := filepath.Join(dir, fname)
	f, err := os.CreateTemp(dir, fname)
	if err != nil {
		l.DPanic("failed to create traffic log", zap.Error(err))
		return nil
	}
	l.Info("opened traffic log", zap.String("path", fpath))
	return (*trafficLog)(f)
}

func (t *trafficLog) maybeWriteIncoming(l *zap.Logger, msg IncomingSessionMsg) {
	t.maybeWriteEntry(l, trafficLogEntry{
		Incoming: msg,
	})
}

func (t *trafficLog) maybeWriteReply(l *zap.Logger, to uuid.UUID, msg OutgoingSessionMsg) {
	t.maybeWriteEntry(l, trafficLogEntry{
		ReplyTo: to,
		Reply:   msg,
	})
}

func (t *trafficLog) maybeWriteBroadcast(l *zap.Logger, msg OutgoingSessionMsg) {
	t.maybeWriteEntry(l, trafficLogEntry{
		Bcast: msg,
	})
}

func (t *trafficLog) maybeWriteEntry(l *zap.Logger, entry trafficLogEntry) {
	if t == nil {
		return
	}
	json, err := json.Marshal(entry)
	if err != nil {
		l.DPanic("failed to marshal traffic log entry", zap.Error(err))
		return
	}
	(*os.File)(t).Write(json)
}

func (t *trafficLog) maybeClose(l *zap.Logger) {
	if t == nil {
		return
	}
	if err := (*os.File)(t).Close(); err != nil {
		l.DPanic("failed to close traffic log", zap.Error(err))
	}
}
