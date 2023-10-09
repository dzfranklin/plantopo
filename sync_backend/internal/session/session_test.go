package session

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	schema "github.com/danielzfranklin/plantopo/api/sync_schema"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

func init() {
	l, err := zap.NewDevelopment()
	if err != nil {
		panic(err)
	}
	zap.ReplaceGlobals(l)
}

func TestSetupFails(t *testing.T) {
	subject := makeSubject(t)
	subject.mockRepoReturn(nil, fmt.Errorf("some error"))

	time.Sleep(10 * time.Millisecond)

	require.True(t, subject.IsFailed())
}

func TestSaveFails(t *testing.T) {
	subject := makeSubject(t)

	c, err := subject.Connect("client")
	require.NoError(t, err)
	o := c.Outgoing()

	_, ok := <-o
	require.True(t, ok)

	// make saves fail
	subject.mockRepoReturn(nil, fmt.Errorf("some error"))

	// give it something to save
	c.Receive(Incoming{
		Seq: 1,
		Change: &schema.Changeset{
			LSet: map[string]schema.Layer{"l1": {Id: "l1", OpacityState: schema.Set, Opacity: 0.5}},
		},
	})

	subject.testTickSave()

	require.True(t, subject.IsFailed())
	_, ok = <-o
	require.False(t, ok)
}

func TestReconnectWithoutDisconnect(t *testing.T) {
	subject := makeSubject(t)

	c1, err := subject.Connect("client1")
	require.NoError(t, err)
	_, ok := <-c1.Outgoing()
	require.True(t, ok)

	c2, err := subject.Connect("client1")
	require.NoError(t, err)
	_, ok = <-c2.Outgoing()
	require.True(t, ok)

	_, ok = <-c1.Outgoing()
	require.False(t, ok)
}

type subjectWrapper struct {
	conf *Config
	*Session
}

func makeSubject(t *testing.T) *subjectWrapper {
	conf := &Config{
		Repo:                     &mockRepo{},
		saveInterval:             newManualInterval(),
		broadcastChangesInterval: newManualInterval(),
		broadcastAwareInterval:   newManualInterval(),
	}
	subject := New(conf, "mapid")
	return &subjectWrapper{conf, subject}
}

func (s *subjectWrapper) mockRepoReturn(value *schema.Changeset, err error) {
	r := (s.conf.Repo).(*mockRepo)
	r.mu.Lock()
	defer r.mu.Unlock()
	r.value = value
	r.err = err
}

func (s *subjectWrapper) testGetLastSave() *schema.Changeset {
	r := (s.conf.Repo).(*mockRepo)
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.value
}

func (s *subjectWrapper) testTickSave() {
	(s.conf.saveInterval).(*manualInterval).tick()
	time.Sleep(10 * time.Millisecond)
}

func (s *subjectWrapper) testTickBroadcastChanges() {
	(s.conf.broadcastChangesInterval).(*manualInterval).tick()
	time.Sleep(10 * time.Millisecond)
}

func (s *subjectWrapper) testTickBroadcastAware() {
	(s.conf.broadcastAwareInterval).(*manualInterval).tick()
	time.Sleep(10 * time.Millisecond)
}

type mockRepo struct {
	mu    sync.Mutex
	value *schema.Changeset
	err   error
}

func (r *mockRepo) GetMapSnapshot(ctx context.Context, mapId string) (schema.Changeset, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	value := schema.Changeset{}
	if r.value != nil {
		value = *r.value
	}
	return value, r.err
}

func (r *mockRepo) SetMapSnapshot(ctx context.Context, mapId string, value schema.Changeset) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.value = &value

	debugValue, err := value.MarshalJSON()
	if err != nil {
		panic(err)
	}
	zap.S().Named("mockRepo").Debug("SetMapSnapshot: ", string(debugValue))

	return r.err
}

type manualInterval struct {
	mu    sync.Mutex
	taken bool
	c     chan time.Time
}

func newManualInterval() *manualInterval {
	return &manualInterval{
		c: make(chan time.Time),
	}
}

func (m *manualInterval) tick() {
	m.c <- time.Now()
}

func (m *manualInterval) Ticker() Tickable {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.taken {
		panic("manualInterval only implements a single call to Ticker")
	}
	m.taken = true
	return &manualTicker{m}
}

type manualTicker struct {
	*manualInterval
}

func (m *manualTicker) Chan() <-chan time.Time {
	return m.c
}

func (m *manualInterval) Stop() {}
