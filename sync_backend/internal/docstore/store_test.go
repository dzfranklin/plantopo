package docstore

import (
	"context"
	"errors"
	schema "github.com/danielzfranklin/plantopo/api/sync_schema"
	"github.com/danielzfranklin/plantopo/sync_backend/internal/doclog"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap/zaptest"
	"testing"
	"time"
)

type MockLog struct {
	mock.Mock
}

func TestSaveLoop(t *testing.T) {
	subject, teardown := setup(t, func(c *Config, m *MockLog) {
		c.SaveInterval = time.Millisecond
		m.On("Get").Return([]*doclog.Entry{})
		m.On("Len").Return(0)
		m.On("Push", mock.Anything, mock.Anything).Return(nil).Once()
	})
	defer teardown()
	_ = subject.WaitForReady()

	err := subject.Update(&schema.Changeset{
		LSet: map[string]*schema.Layer{
			"layer1": {
				Id:           "layer1",
				OpacityState: schema.Set,
				Opacity:      0.5,
			},
		},
	})
	require.NoError(t, err)

	time.Sleep(5 * time.Millisecond)
}

func setup(t *testing.T, setup func(c *Config, m *MockLog)) (*Store, func()) {
	t.Helper()

	log := &MockLog{}

	c := &Config{
		Logger: zaptest.NewLogger(t),
		Loader: func(ctx context.Context, mapId string) (DocLogger, error) {
			if mapId != "map1" {
				panic("unexpected mapId")
			}
			return log, nil
		},
	}
	if setup != nil {
		setup(c, log)
	}
	subject := New("map1", *c)
	return subject, func() {
		log.On("Len").Return(10).Maybe()
		log.On("Push", mock.Anything, mock.Anything).Return(nil).Maybe()
		log.On("Replace", mock.Anything, mock.Anything).Return(nil).Maybe()
		_ = subject.Close()
		log.AssertExpectations(t)
	}
}

func TestEmptyUpdateNotSaved(t *testing.T) {
	subject, teardown := setup(t, func(c *Config, m *MockLog) {
		m.On("Get").Return([]*doclog.Entry{})
	})
	defer teardown()
	_ = subject.WaitForReady()

	err := subject.Update(&schema.Changeset{})
	require.NoError(t, err)

	err = subject.Close()
	require.NoError(t, err)
}

func TestSubscribeToUpdate(t *testing.T) {
	subject, teardown := setup(t, func(c *Config, m *MockLog) {
		m.On("Get").Return([]*doclog.Entry{})
	})
	defer teardown()

	c := make(chan uint64, 1)
	subject.Subscribe(c)
	defer subject.Unsubscribe(c)

	_ = subject.WaitForReady()

	err := subject.Update(&schema.Changeset{})
	require.NoError(t, err)

	got := <-c
	require.True(t, got > 0)
}

func TestSlowSubscriberDoesNotBlockPeers(t *testing.T) {
	subject, teardown := setup(t, func(c *Config, m *MockLog) {
		m.On("Get").Return([]*doclog.Entry{})
	})
	defer teardown()

	slowC := make(chan uint64, 1)
	subject.Subscribe(slowC)
	defer subject.Unsubscribe(slowC)

	fastC := make(chan uint64, 1)
	subject.Subscribe(fastC)
	defer subject.Unsubscribe(fastC)

	_ = subject.WaitForReady()

	for i := 0; i < 1000; i++ {
		err := subject.Update(&schema.Changeset{})
		require.NoError(t, err)
		<-fastC
	}
	<-slowC
}

func TestLoadFailure(t *testing.T) {
	log := &MockLog{}
	c := &Config{
		Logger: zaptest.NewLogger(t),
		Loader: func(ctx context.Context, mapId string) (DocLogger, error) {
			return nil, errors.New("boom")
		},
	}
	subject := New("map1", *c)

	err := subject.WaitForReady()
	require.ErrorIs(t, ErrFatal, err)

	log.AssertExpectations(t)
}

func TestLoadNew(t *testing.T) {
	subject, teardown := setup(t, func(c *Config, m *MockLog) {
		m.On("Get").Return([]*doclog.Entry{})
	})
	defer teardown()
	err := subject.WaitForReady()
	require.NoError(t, err)
}

func TestLoadExisting(t *testing.T) {
	subject, teardown := setup(t, func(c *Config, m *MockLog) {
		m.On("Get").Return([]*doclog.Entry{
			{
				GenerationStart: 10,
				GenerationEnd:   10,
				Changeset: &schema.Changeset{
					LSet: map[string]*schema.Layer{
						"layer1": {
							Id:           "layer1",
							OpacityState: schema.Set,
							Opacity:      0.5,
						},
					},
				},
			},
			{
				GenerationStart: 11,
				GenerationEnd:   15,
				Changeset: &schema.Changeset{
					LSet: map[string]*schema.Layer{
						"layer1": {
							Id:           "layer1",
							OpacityState: schema.Set,
							Opacity:      1.0,
						},
					},
				},
			},
		})
	})
	defer teardown()

	_ = subject.WaitForReady()

	gotG, gotC, err := subject.ChangesAfter(9)
	require.NoError(t, err)
	require.Equal(t, uint64(15), gotG)
	require.Equal(t, &schema.Changeset{
		LSet: map[string]*schema.Layer{
			"layer1": {
				Id:           "layer1",
				OpacityState: schema.Set,
				Opacity:      1,
			},
		},
	}, gotC)
}

func (m *MockLog) Len() int {
	args := m.Called()
	return args.Int(0)
}

func (m *MockLog) Get() []*doclog.Entry {
	args := m.Called()
	return args.Get(0).([]*doclog.Entry)
}

func (m *MockLog) Push(ctx context.Context, entry *doclog.Entry) error {
	args := m.Called(ctx, entry)
	return args.Error(0)
}

func (m *MockLog) Replace(ctx context.Context, entry *doclog.Entry) error {
	args := m.Called(ctx, entry)
	return args.Error(0)
}
