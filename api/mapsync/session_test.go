package mapsync

import (
	"context"
	"testing"
	"time"

	"github.com/danielzfranklin/plantopo/api/logger"
	schema "github.com/danielzfranklin/plantopo/api/sync_schema"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

var mapA = uuid.MustParse("d0000000-0000-0000-0000-00000000000a")

func TestBasicSession(t *testing.T) {
	config := Config{
		Host:  "fake0.plantopo.com",
		RunId: uuid.MustParse("a0000000-0000-0000-0000-000000000000"),
		Repo:  &mockDb{values: make(map[uuid.UUID][]byte)},
	}
	config.Session.EmptyTimeout = time.Millisecond * 5
	config.Session.SaveInterval = time.Millisecond * 5
	config.Session.BroadcastInterval = time.Millisecond * 5

	ctx := logger.WithCtx(context.Background(), logger.NewTestLogger(t))
	ctx, cancel := context.WithCancel(ctx)
	closeNotify := make(chan uuid.UUID, 1)
	subject, err := newSession(
		ctx,
		config,
		closeNotify,
		mapA,
	)
	require.NoError(t, err)
	defer func() {
		cancel()
		<-closeNotify
	}()

	c1Ok := make(chan Connection, 10)
	c1Out := make(chan OutgoingSessionMsg, 10)
	subject.connect <- &connectRequest{
		mapId:    mapA,
		clientId: uuid.MustParse("c0000000-0000-0000-0000-000000000001"),
		outgoing: c1Out,
		ok:       c1Ok,
	}
	c1 := <-c1Ok

	c2Ok := make(chan Connection, 10)
	c2Out := make(chan OutgoingSessionMsg, 10)
	subject.connect <- &connectRequest{
		mapId:    mapA,
		clientId: uuid.MustParse("c0000000-0000-0000-0000-000000000002"),
		outgoing: c2Out,
		ok:       c2Ok,
	}
	c2 := <-c2Ok

	emptyChangeset := schema.Changeset{}
	wantWelcomeC1 := OutgoingSessionMsg{
		Aware: &map[uuid.UUID]schema.Aware{
			c1.ClientId: {
				ClientId: c1.ClientId,
			},
		},
		Change: &emptyChangeset,
	}
	wantWelcomeC2 := OutgoingSessionMsg{
		Aware: &map[uuid.UUID]schema.Aware{
			c1.ClientId: {
				ClientId: c1.ClientId,
			},
			c2.ClientId: {
				ClientId: c2.ClientId,
			},
		},
		Change: &emptyChangeset,
	}

	toC1 := <-c1Out
	require.Equal(t, wantWelcomeC1, toC1)

	toC2 := <-c2Out
	require.Equal(t, wantWelcomeC2, toC2)

	c1.Incoming <- IncomingSessionMsg{
		Seq:  1,
		From: c1.ClientId,
		Aware: &schema.Aware{
			ClientId:         c1.ClientId,
			SelectedFeatures: &[]string{"f1"},
		},
		Change: &schema.Changeset{
			LSet: map[string]schema.Layer{
				"l1": {
					Id:       "l1",
					IdxState: schema.Set,
					Idx:      "O",
				},
				"l2": {
					Id:       "l2",
					IdxState: schema.Set,
					Idx:      "O",
				},
			},
		},
	}

	wantReply := OutgoingSessionMsg{
		Change: &schema.Changeset{
			LSet: map[string]schema.Layer{
				"l2": {
					Id:       "l2",
					IdxState: schema.Set,
					Idx:      "g)",
				},
			},
		},
	}
	wantBcast := OutgoingSessionMsg{
		Acks: &map[uuid.UUID]int32{
			c1.ClientId: 1,
		},
		Aware: &map[uuid.UUID]schema.Aware{
			c1.ClientId: {
				ClientId:         c1.ClientId,
				SelectedFeatures: &[]string{"f1"},
			},
			c2.ClientId: {
				ClientId: c2.ClientId,
			},
		},
		Change: &schema.Changeset{
			LSet: map[string]schema.Layer{
				"l1": {
					Id:       "l1",
					IdxState: schema.Set,
					Idx:      "O",
				},
				"l2": {
					Id:       "l2",
					IdxState: schema.Set,
					Idx:      "g)",
				},
			},
		},
	}

	time.Sleep(config.Session.BroadcastInterval * 2)

	toC1 = <-c1Out
	require.Equal(t, wantReply, toC1)

	toC1 = <-c1Out
	require.Equal(t, wantBcast, toC1)

	toC2 = <-c2Out
	require.Equal(t, wantBcast, toC2)
}
