package mailer

import (
	"context"
	"testing"
	"time"

	"github.com/danielzfranklin/plantopo/logger"
	"github.com/danielzfranklin/plantopo/testutil"
	"github.com/stretchr/testify/suite"
	"go.uber.org/zap/zaptest"
)

func TestMailer(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration tests against postgres")
	}
	sandbox := testutil.PgxSandbox()
	defer sandbox.Close()
	l := zaptest.NewLogger(t)
	ctx := logger.WithCtx(context.Background(), l)
	suite.Run(t, &S{
		Config: &Config{
			Pg:                     sandbox.Pg,
			Workers:                2,
			WorkerDelayOnSendError: time.Millisecond * 5,
		},
		sandbox: sandbox,
		ctx:     ctx,
	})
}

type S struct {
	suite.Suite
	*Config
	sandbox *testutil.PgxSConn
	ctx     context.Context
}

func (s *S) SetupTest() {
	s.sandbox.Reset()
	s.Config.sender = &mockSender{}
}

type mockSender struct {
	cb func(p payload) error
}

func (m *mockSender) send(p payload) error {
	if m.cb != nil {
		return m.cb(p)
	} else {
		return nil
	}
}

func (s *S) TestSendsOnce(t *testing.T) {
	t.Skip("TODO: ")
}

func (s *S) TestRetriesSendError(t *testing.T) {
	t.Skip("TODO: ")
}
