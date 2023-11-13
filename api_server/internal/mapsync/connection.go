package mapsync

import (
	"context"
	"fmt"
	api "github.com/danielzfranklin/plantopo/api/v1"
)

type Connection struct {
	target string
	client api.SyncBackend_ConnectClient
	cancel context.CancelFunc
}

func connect(info preConn) (*Connection, error) {
	connCtx, cancel := context.WithCancel(context.Background())
	conn, err := info.backend.Connect(connCtx)
	if err != nil {
		cancel()
		return nil, fmt.Errorf("failed to connect to backend: %w", err)
	}

	err = conn.Send(&api.SyncBackendIncomingMessage{
		Msg: &api.SyncBackendIncomingMessage_Connect{
			Connect: info.toRequest(),
		},
	})
	if err != nil {
		cancel()
		return nil, fmt.Errorf("failed to send connect request to backend %s: %w", info.setup.Backend, err)
	}

	return &Connection{
		target: info.setup.Backend,
		client: conn,
		cancel: cancel,
	}, nil
}

func (c *Connection) SendUpdate(update *api.SyncBackendIncomingUpdate) error {
	return c.send(&api.SyncBackendIncomingMessage{Msg: &api.SyncBackendIncomingMessage_Update{Update: update}})
}

func (c *Connection) Recv() (*api.SyncBackendOutgoingMessage, error) {
	return c.client.Recv()
}

func (c *Connection) send(msg *api.SyncBackendIncomingMessage) error {
	err := c.client.Send(msg)
	if err != nil {
		return fmt.Errorf("failed to send message to %s: %w", c.target, err)
	}
	return nil
}

func (c *Connection) Close() {
	c.cancel()
}
