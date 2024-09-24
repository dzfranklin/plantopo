package pelevation

import (
	"context"
	"errors"
	"github.com/dzfranklin/plantopo/backend/internal/ptest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/geojson/geometry"
	"sync"
	"testing"
	"time"
)

func TestService(t *testing.T) {
	t.Parallel()

	makeSvc := func(t *testing.T) (*Service, *Mocklookuper) {
		l := ptest.NewTestLogger(t)
		inner := NewMocklookuper(t)
		svc := newService(l, func() (lookuper, error) {
			return inner, nil
		})
		return svc, inner
	}
	ctx := context.Background()

	t.Run("basic", func(t *testing.T) {
		subject, inner := makeSvc(t)

		inner.EXPECT().lookup(mock.Anything, mock.Anything).Return([]int16{42}, nil).Once()

		got, err := subject.Lookup(ctx, []geometry.Point{{0, 0}})
		require.NoError(t, err)
		assert.Equal(t, []int16{42}, got)
	})

	t.Run("retries open", func(t *testing.T) {
		l := ptest.NewTestLogger(t)
		inner := NewMocklookuper(t)
		creates := 0
		subject := newService(l, func() (lookuper, error) {
			creates++
			if creates == 1 {
				return nil, errors.New("some error")
			}
			return inner, nil
		})

		inner.EXPECT().lookup(mock.Anything, mock.Anything).Return([]int16{42}, nil).Once()

		got, err := subject.Lookup(ctx, []geometry.Point{{0, 0}})
		require.NoError(t, err)
		assert.Equal(t, []int16{42}, got)
	})

	t.Run("lookup before open", func(t *testing.T) {
		l := ptest.NewTestLogger(t)
		inner := NewMocklookuper(t)
		openSig := make(chan struct{})
		subject := newService(l, func() (lookuper, error) {
			<-openSig
			return inner, nil
		})

		inner.EXPECT().lookup(mock.Anything, mock.Anything).Return([]int16{42}, nil).Once()

		doneSig := make(chan struct{})
		go func() {
			defer close(doneSig)
			_, err := subject.Lookup(ctx, []geometry.Point{{0, 0}})
			require.NoError(t, err)
		}()

		time.Sleep(100 * time.Millisecond)
		close(openSig)

		<-doneSig
	})

	t.Run("concurrent lookup", func(t *testing.T) {
		subject, inner := makeSvc(t)

		inner.EXPECT().lookup(mock.Anything, mock.Anything).Return([]int16{42}, nil)

		for i := 0; i < 10; i++ {
			var wg sync.WaitGroup
			for i := 0; i < 100; i++ {
				wg.Add(1)
				go func() {
					defer wg.Done()
					got, err := subject.Lookup(ctx, []geometry.Point{{0, 0}})
					require.NoError(t, err)
					assert.Equal(t, []int16{42}, got)
				}()
			}
			wg.Wait()
		}
	})
}
