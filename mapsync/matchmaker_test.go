package mapsync

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/danielzfranklin/plantopo/logger"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"go.uber.org/zap/zaptest"
)

type setup struct {
	ctx      context.Context
	mrdb     *miniredis.Miniredis
	rdb      *redis.Client
	db       *mockDb
	wg       *sync.WaitGroup
	subjects []Matchmaker
}

var testLockExpiry = time.Duration(time.Millisecond * 5)
var testIdleTimeout = time.Duration(time.Millisecond * 5)

type mockDb struct {
	mu     sync.Mutex
	values map[uuid.UUID][]byte
}

func (m *mockDb) GetMapSnapshot(ctx context.Context, mapId uuid.UUID) ([]byte, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.values[mapId], nil
}

func (m *mockDb) SetMapSnapshot(ctx context.Context, mapId uuid.UUID, value []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.values[mapId] = value
	return nil
}

func Setup(t *testing.T, n int) (setup, func()) {
	ctx, cancel := context.WithCancel(context.Background())
	l := zaptest.NewLogger(t, zaptest.WrapOptions(
		zap.Development(),
		zap.AddStacktrace(zap.ErrorLevel)),
	)
	ctx = logger.WithCtx(ctx, l)

	mrdb, err := miniredis.Run()
	require.NoError(t, err)

	rdb := redis.NewClient(&redis.Options{
		Addr: mrdb.Addr(),
	})

	var wg sync.WaitGroup

	db := &mockDb{
		values: make(map[uuid.UUID][]byte),
	}

	s := setup{
		ctx:  ctx,
		mrdb: mrdb,
		rdb:  rdb,
		db:   db,
		wg:   &wg,
	}

	for i := 0; i < n; i++ {
		CreateSubject(ctx, &s, s.wg)
	}

	return s, func() {
		cancel()
		s.wg.Wait()
		mrdb.Close()
	}
}

func CreateSubject(ctx context.Context, s *setup, wg *sync.WaitGroup) *Matchmaker {
	i := len(s.subjects)
	if i > 9 {
		panic("current setup implementation presumes no more than 9")
	}
	config := Config{
		Host:  fmt.Sprintf("fake%d.plantopo.com", i),
		RunId: uuid.MustParse(fmt.Sprintf("a0000000-0000-0000-0000-00000000000%d", i)),
		Rdb:   s.rdb,
		Wg:    wg,
		Repo:  s.db,
	}
	config.Matchmaker.LockExpiry = testLockExpiry
	config.Session.EmptyTimeout = testIdleTimeout

	subject := NewMatchmaker(ctx, config)
	s.subjects = append(s.subjects, subject)
	return &subject
}

func TestSingleSimple(t *testing.T) {
	setup, teardown := Setup(t, 1)
	defer teardown()
	ctx := setup.ctx
	subject := setup.subjects[0]
	mapA := uuid.MustParse("d0000000-0000-0000-0000-000000000001")
	mapB := uuid.MustParse("d0000000-0000-0000-0000-000000000002")

	_, err := subject.Connect(ctx, mapA, noopOutgoingChan())
	require.NoError(t, err)

	_, err = subject.Connect(ctx, mapB, noopOutgoingChan())
	require.NoError(t, err)

	_, err = subject.Connect(ctx, mapA, noopOutgoingChan())
	require.NoError(t, err)
}

func TestLocks(t *testing.T) {
	setup, teardown := Setup(t, 2)
	defer teardown()
	ctx := setup.ctx
	server0 := setup.subjects[0]
	server1 := setup.subjects[1]
	mapA := uuid.MustParse("00000000-0000-0000-0000-000000000001")

	_, err := server0.Connect(ctx, mapA, noopOutgoingChan())
	require.NoError(t, err)

	_, err = server1.Connect(ctx, mapA, noopOutgoingChan())
	require.ErrorIs(t, err, ErrShouldTrySpecific{addr: "fake0.plantopo.com"})
}

func TestRefreshesLock(t *testing.T) {
	setup, teardown := Setup(t, 2)
	defer teardown()
	ctx := setup.ctx
	server0 := setup.subjects[0]
	server1 := setup.subjects[1]
	mapA := uuid.MustParse("00000000-0000-0000-0000-000000000001")

	_, err := server0.Connect(ctx, mapA, noopOutgoingChan())
	require.NoError(t, err)

	time.Sleep(2 * testLockExpiry)

	_, err = server1.Connect(ctx, mapA, noopOutgoingChan())
	require.ErrorIs(t, err, ErrShouldTrySpecific{addr: "fake0.plantopo.com"})
}

func TestClosesEmptySession(t *testing.T) {
	setup, teardown := Setup(t, 2)
	defer teardown()
	ctx := setup.ctx
	server0 := setup.subjects[0]
	server1 := setup.subjects[1]
	mapA := uuid.MustParse("00000000-0000-0000-0000-000000000001")

	conn0, err := server0.Connect(ctx, mapA, noopOutgoingChan())
	require.NoError(t, err)

	_, err = server1.Connect(ctx, mapA, noopOutgoingChan())
	require.ErrorIs(t, err, ErrShouldTrySpecific{addr: "fake0.plantopo.com"})

	conn0.Disconnect()

	_, err = server1.Connect(ctx, mapA, noopOutgoingChan())
	require.ErrorIs(t, err, ErrShouldTrySpecific{addr: "fake0.plantopo.com"})

	time.Sleep(testIdleTimeout * 2)

	_, err = server1.Connect(ctx, mapA, noopOutgoingChan())
	require.NoError(t, err)
}

func TestDisconnectReleasesLocks(t *testing.T) {
	s, teardown := Setup(t, 1)
	ctx := s.ctx
	defer teardown()

	ctx2, close2 := context.WithCancel(s.ctx)
	var wg2 sync.WaitGroup
	CreateSubject(ctx2, &s, &wg2)

	mapA := uuid.MustParse("00000000-0000-0000-0000-000000000001")

	_, err := s.subjects[1].Connect(ctx, mapA, noopOutgoingChan())
	require.NoError(t, err)

	_, err = s.subjects[0].Connect(ctx, mapA, noopOutgoingChan())
	require.ErrorIs(t, err, ErrShouldTrySpecific{addr: "fake1.plantopo.com"})

	close2()
	wg2.Wait()

	_, err = s.subjects[0].Connect(ctx, mapA, noopOutgoingChan())
	require.NoError(t, err)
}

func noopOutgoingChan() chan OutgoingSessionMsg {
	c := make(chan OutgoingSessionMsg)
	go func() {
		for range c {
		}
	}()
	return c
}
