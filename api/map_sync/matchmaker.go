package map_sync

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/danielzfranklin/plantopo/api/logger"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

type Matchmaker chan matchmakerCommand

type matchmakerCommand struct {
	connect *connectRequest
	healthz chan bool
}

type ErrShouldTrySpecific struct {
	Addr string `json:"addr"`
}

func (e ErrShouldTrySpecific) Error() string {
	return fmt.Sprintf("try at mapsync server: %s", e.Addr)
}

// redis: MUST be a single-node redis instance
func NewMatchmaker(
	ctx context.Context,
	c Config,
) Matchmaker {
	if c.Host == "" {
		panic("Addr must be set")
	}
	if c.RunId == uuid.Nil {
		c.RunId = uuid.New()
	}
	if c.Rdb == nil {
		panic("Rdb must be set")
	}
	if c.Matchmaker.LockExpiry == 0 {
		c.Matchmaker.LockExpiry = time.Minute * 5
	}

	c.Wg.Add(1)
	commandChan := make(chan matchmakerCommand)
	go matchmaker(ctx, c, commandChan)
	return commandChan
}

type TryOtherError struct {
	addr string
}

func (e TryOtherError) Error() string {
	return fmt.Sprintf("try other: %s", e.addr)
}

type Connection struct {
	ClientId uuid.UUID
	// You send incoming messages to this channel
	Incoming   chan IncomingSessionMsg
	Disconnect func()
}

func (m *Matchmaker) Healthz(ctx context.Context) bool {
	l := logger.FromCtx(ctx).Named("matchmaker.Healthz")
	healthz := make(chan bool)
	*m <- matchmakerCommand{healthz: healthz}
	select {
	case <-ctx.Done():
		l.Error("timeout waiting for matchmaker healthz")
		return false
	case ok := <-healthz:
		return ok
	}
}

// Implicitly creates resources on the first save if not previously opened.
// Users will check authz before calling us, which also ensures the
// corresponding meta tables exist.
func (m *Matchmaker) Connect(
	ctx context.Context,
	mapId uuid.UUID,
	// Random, unique to this specific request
	clientId uuid.UUID,
	// You receive outgoing messages on this channel
	outgoing chan OutgoingSessionMsg,
) (*Connection, error) {
	errChan := make(chan error)
	successChan := make(chan *Connection)
	*m <- matchmakerCommand{
		connect: &connectRequest{
			mapId:    mapId,
			clientId: clientId,
			outgoing: outgoing,
			ok:       successChan,
			err:      errChan,
		},
	}
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case err := <-errChan:
		return nil, err
	case conn := <-successChan:
		return conn, nil
	}
}

func matchmaker(
	ctx context.Context,
	c Config,
	commandChan chan matchmakerCommand,
) {
	l := logger.FromCtx(ctx).Named("matchmaker").With(
		zap.String("runId", c.RunId.String()),
		zap.String("addr", c.Host),
	)
	ctx = logger.WithCtx(ctx, l)
	l.Info("started matchmaker")

	localSessions := make(map[uuid.UUID]session)
	// session sends when it closes itself
	closeNotifies := make(chan uuid.UUID)
	sessionCtx, closeSessions := context.WithCancel(ctx)

	defer func() {
		l.Info("Shutting down matchmaker")
		ctx = context.WithoutCancel(ctx)

		locksHeld := lockKeys(localSessions)
		l.Debug("Waiting for sessions to close")
		closeSessions()
		for len(localSessions) != 0 {
			mapId := <-closeNotifies
			delete(localSessions, mapId)

		}

		l.Debug("Releasing locks")
		// Our context is cancelled so we use a fresh one to try and release our locks
		err := releaseLocks(ctx, c, locksHeld)
		if err != nil {
			l.DPanic("failed to release locks", zap.Error(err))
		}

		l.Info("Shut down matchmaker")
		c.Wg.Done()
	}()

	for {
		select {
		case <-ctx.Done():
			return
		case <-time.After(c.Matchmaker.LockExpiry / 4):
			// Refresh locks
			keys := lockKeys(localSessions)
			if len(keys) != 0 {
				err := refreshLocks(ctx, c, keys)
				if err != nil {
					if ctx.Err() != nil {
						return
					} else {
						l.DPanic("failed to refresh all locks", zap.Error(err))
						return
					}
				}
			}
		case mapId := <-closeNotifies:
			// Session is ready to be closed
			l.Info("session closed, cleaning up", zap.String("mapId", mapId.String()))
			delete(localSessions, mapId)
			releaseLocks(ctx, c, []string{lockKey(mapId)})
		case cmd := <-commandChan:
			if cmd.healthz != nil {
				cmd.healthz <- true
			} else if cmd.connect != nil {
				// Handle connect request
				req := cmd.connect
				l := l.With(zap.String("mapId", req.mapId.String()))
				l.Debug("got connect request",
					zap.String("clientId", req.clientId.String()))

				session, ok := localSessions[req.mapId]
				if ok {
					l.Info("found existing local session")
					session.connect <- req
					continue
				}

				l.Debug("trying to aquire lock")
				lockStatus, err := tryAcquireLock(ctx, c, lockKey(req.mapId))
				if err != nil {
					l.Error("error when trying to aquire lock", zap.Error(err))
					req.err <- err
				} else if !lockStatus.acquired {
					l.Info("session locked by remote",
						zap.String("existingAddr", lockStatus.existingAddr))
					req.err <- ErrShouldTrySpecific{Addr: lockStatus.existingAddr}
				} else {
					l.Info("acquired lock, creating new local session")
					session, err := newSession(sessionCtx, c, closeNotifies, req.mapId)
					if err != nil {
						l.DPanic("failed to create new session", zap.Error(err))
						continue
					}
					localSessions[req.mapId] = session
					session.connect <- req
				}
			}
		}
	}

}

func lockKeys(local map[uuid.UUID]session) []string {
	keys := make([]string, len(local))
	i := 0
	for mapId := range local {
		keys[i] = lockKey(mapId)
		i++
	}
	return keys
}

var releaseLocksScript = redis.NewScript(`
local errors = {}
local expected = ARGV[1]
for _, key in ipairs(KEYS) do
	local actual = redis.call("GET", key)
	if actual == expected then
		redis.call("DEL", key)
	else
		table.insert(errors, key)
		table.insert(errors, actual)
	end
end
return errors
`)

func releaseLocks(ctx context.Context, c Config, keys []string) error {
	l := logger.FromCtx(ctx).Named("releaseLocks")

	if len(keys) == 0 {
		l.Debug("no locks to release")
		return nil
	}

	expected := marshallLockValue(c.Host, c.RunId)
	res := releaseLocksScript.Run(ctx, c.Rdb, keys, expected)

	if res.Err() != nil {
		return res.Err()
	}

	result, err := res.StringSlice()
	if err != nil {
		return fmt.Errorf("expected string slice result from release lock script: %w", err)
	}

	if len(result) != 0 {
		l := logger.FromCtx(ctx)
		for i := 0; i < len(result); i += 2 {
			key := result[i]
			actual := result[i+1]
			l.Error("failed to release lock",
				zap.String("key", key),
				zap.String("actual", actual),
				zap.String("expected", expected),
			)
		}
		return fmt.Errorf("failed to release %d locks", len(result)/2)
	}

	l.Debug("released", zap.Strings("keys", keys))

	return nil
}

var refreshLocksScript = redis.NewScript(`
local errors = {}
local expected = ARGV[1]
local newExpiry = ARGV[2]
for _, key in ipairs(KEYS) do
	local actual = redis.call("GET", key)
	if actual == expected then
		redis.call("PEXPIRE", key, newExpiry)
	else
		table.insert(errors, key)
		table.insert(errors, actual)
	end
end
return errors
`)

func refreshLocks(
	ctx context.Context,
	c Config,
	keys []string,
) error {
	expected := marshallLockValue(c.Host, c.RunId)
	expiry := c.Matchmaker.LockExpiry
	res := refreshLocksScript.Run(ctx, c.Rdb,
		keys, expected, expiry.Milliseconds())

	if res.Err() != nil {
		return res.Err()
	}

	result, err := res.StringSlice()
	if err != nil {
		return fmt.Errorf("expected string slice result from refresh lock script: %w", err)
	}

	if len(result) != 0 {
		l := logger.FromCtx(ctx)
		for i := 0; i < len(result); i += 2 {
			key := result[i]
			actual := result[i+1]
			l.Error("failed to refresh lock",
				zap.String("key", key),
				zap.String("actual", actual),
				zap.String("expected", expected),
			)
		}
		return fmt.Errorf("failed to refresh %d locks", len(result)/2)
	}

	return nil
}

type lockStatus struct {
	acquired     bool
	existingAddr string
}

func tryAcquireLock(
	ctx context.Context,
	c Config,
	key string,
) (lockStatus, error) {
	value := marshallLockValue(c.Host, c.RunId)
	args := redis.SetArgs{Mode: "NX", Get: true, TTL: c.Matchmaker.LockExpiry}
	res := c.Rdb.SetArgs(ctx, key, value, args)
	if res.Err() == redis.Nil {
		return lockStatus{acquired: true}, nil
	} else if res.Err() != nil {
		return lockStatus{}, res.Err()
	}

	existingAddr, err := unmarshallLockAddr(res.Val())
	if err != nil {
		return lockStatus{}, err
	}
	return lockStatus{acquired: false, existingAddr: existingAddr}, nil
}

func lockKey(mapId uuid.UUID) string {
	return "matchmaker-lock:" + mapId.String()
}

func marshallLockValue(addr string, id uuid.UUID) string {
	return addr + ":" + id.String()
}

func unmarshallLockAddr(value string) (string, error) {
	parts := strings.Split(value, ":")
	if len(parts) != 2 {
		return "", fmt.Errorf("unexpected matchmaker-lock value %#v", value)
	}
	return parts[0], nil
}
