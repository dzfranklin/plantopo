package routes

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"net/http"
	"time"

	"github.com/danielzfranklin/plantopo/api/sync_schema"
	api "github.com/danielzfranklin/plantopo/api/v1"
	"github.com/danielzfranklin/plantopo/api_server/internal/anon_name"
	"github.com/danielzfranklin/plantopo/api_server/internal/loggers"
	"github.com/danielzfranklin/plantopo/api_server/internal/maps"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		for _, allowed := range permittedOrigins {
			if origin == allowed {
				return true
			}
		}
		return false
	},
	Error: func(w http.ResponseWriter, r *http.Request, status int, reason error) {
		writeError(r, w, &ErrorReply{
			Code:    status,
			Reason:  "websocketError",
			Message: reason.Error(),
		})
	},
}

func (s *Services) mapSyncSocketHandler(w http.ResponseWriter, r *http.Request) {
	mapId := mux.Vars(r)["id"]
	clientId := r.URL.Query().Get("clientId")
	if clientId == "" {
		writeBadRequest(r, w)
		return
	}

	l := loggers.FromCtx(r.Context()).Sugar().With(
		"mapId", mapId,
		"clientId", clientId,
	)

	// Note the upgrader checks the Origin header matches the Host header. Without
	// that we couldn't rely on cookies for authentication.
	sess, err := s.SessionManager.Get(r)
	if err != nil {
		writeInternalError(r, w, err)
		return
	}
	userId := uuid.Nil
	if sess != nil {
		userId = sess.UserId
	}

	authz, err := s.Maps.CheckOpen(
		r.Context(),
		maps.AuthzRequest{UserId: userId, MapId: mapId},
	)
	if err != nil {
		if errors.Is(err, maps.ErrMapNotFound) {
			writeError(r, w, &ErrorReply{
				Code:    http.StatusNotFound,
				Reason:  "notFound",
				Message: "Map does not exist",
			})
			return
		} else if errors.Is(err, context.Canceled) {
			return
		} else {
			writeInternalError(r, w, err)
			return
		}
	}

	if !authz.CanView {
		if userId == uuid.Nil {
			writeUnauthorized(r, w)
			return
		} else {
			writeForbidden(r, w)
			return
		}
	}

	trustedAware := sync_schema.TrustedAware{ClientId: clientId}
	if userId == uuid.Nil {
		trustedAware.Name = anon_name.For(clientId)
	} else {
		trustedAware.UserId = &userId
		user, err := s.Users.Get(r.Context(), userId)
		if err != nil {
			writeInternalError(r, w, err)
			return
		}
		trustedAware.Name = user.FullName
	}

	l.Info("setting up connection with matchmaker")
	resp, err := s.Matchmaker.SetupConnection(r.Context(), &api.MatchmakerSetupConnectionRequest{
		MapId: mapId,
	})
	if err != nil {
		if errors.Is(err, context.Canceled) {
			return
		} else {
			writeInternalError(r, w, err)
			return
		}
	}
	l = l.With("backend", resp.Backend)

	l.Info("connecting to backend")
	bClient, err := s.SyncBackends.Dial(resp.Backend)
	if err != nil {
		if errors.Is(err, context.Canceled) {
			return
		} else {
			writeInternalError(r, w,
				fmt.Errorf("failed to dial backend (%s): %w", resp.Backend, err))
			return
		}
	}
	bCtx, cancelB := context.WithCancel(context.Background())
	b, err := bClient.Connect(bCtx)
	if err != nil {
		cancelB()
		if errors.Is(err, context.Canceled) {
			return
		} else {
			writeInternalError(r, w,
				fmt.Errorf("failed to connect to backend %s: %s", resp.Backend, err))
			return
		}
	}
	l.Info("sending connect to backend")
	err = b.Send(&api.SyncBackendIncomingMessage{
		Msg: &api.SyncBackendIncomingMessage_Connect{
			Connect: &api.SyncBackendConnectRequest{
				MapId:    mapId,
				Token:    resp.Token,
				ClientId: clientId,
			},
		},
	})
	if err != nil {
		cancelB()
		if errors.Is(err, context.Canceled) {
			return
		} else {
			writeInternalError(r, w,
				fmt.Errorf("failed to send connect to backend %s: %s", resp.Backend, err))
			return
		}
	}

	l.Info("upgrading")
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		// Upgrader handles writing the error
		cancelB()
		return
	}
	l.Info("upgraded")

	state := &sockState{
		l:       l,
		conn:    conn,
		b:       b,
		cancelB: cancelB,

		trustedAware: trustedAware,
	}
	go socketReader(state)
	go socketWriter(state)
}

type incomingDto struct {
	Seq    int32                  `json:"seq"`
	Aware  *sync_schema.Aware     `json:"aware"`
	Change *sync_schema.Changeset `json:"change"`
}

type sockState struct {
	l       *zap.SugaredLogger
	conn    *websocket.Conn
	b       api.SyncBackend_ConnectClient
	cancelB func()

	trustedAware sync_schema.TrustedAware
}

func socketReader(
	s *sockState,
) {
	var err error
	defer func() {
		if err != nil {
			s.l.Warnw("closing socketReader due to error", zap.Error(err))
			writeCloseMessage(s.conn, websocket.CloseInternalServerErr, err.Error())
		} else {
			s.l.Info("closing socketReader")
			writeCloseMessage(s.conn, websocket.CloseNormalClosure, "")
		}
		_ = s.conn.Close()
		s.cancelB()
	}()
	for {
		var msg incomingDto
		err = s.conn.ReadJSON(&msg)
		if err != nil {
			err = nil
			return
		}

		var aware []byte
		if msg.Aware != nil {
			msg.Aware.Trusted = s.trustedAware
			aware, err = json.Marshal(msg.Aware)
			if err != nil {
				return
			}
		}

		var change []byte
		change, err = json.Marshal(msg.Change)
		if err != nil {
			return
		}

		err = s.b.Send(&api.SyncBackendIncomingMessage{
			Msg: &api.SyncBackendIncomingMessage_Update{
				Update: &api.SyncBackendIncomingUpdate{
					Seq:    msg.Seq,
					Aware:  aware,
					Change: change,
				},
			},
		})
		if err != nil {
			return
		}
	}
}

type outgoingDto struct {
	Ack    int32           `json:"ack,omitempty"`
	Aware  json.RawMessage `json:"aware,omitempty"`
	Change json.RawMessage `json:"change,omitempty"`
	Error  string          `json:"error,omitempty"`
}

func socketWriter(s *sockState) {
	var err error
	defer func() {
		if err != nil {
			s.l.Warnw("closing socketWriter due to error", zap.Error(err))
			writeCloseMessage(s.conn, websocket.CloseInternalServerErr, err.Error())
		} else {
			s.l.Info("closing socketWriter")
			writeCloseMessage(s.conn, websocket.CloseNormalClosure, "")
		}
		_ = s.conn.Close()
		s.cancelB()
	}()
	for {
		var msg *api.SyncBackendOutgoingMessage
		msg, err = s.b.Recv()
		if err != nil {
			if status.Code(err) == codes.Canceled {
				err = nil
				return
			}
			return
		}

		dto := outgoingDto{
			Ack:    msg.Ack,
			Aware:  msg.Aware,
			Change: msg.Change,
		}
		var data []byte
		data, err = json.Marshal(dto)
		if err != nil {
			return
		}

		err = s.conn.WriteMessage(websocket.TextMessage, data)
		if err != nil {
			err = nil
			return
		}
	}
}

func writeCloseMessage(sock *websocket.Conn, code int, reason string) {
	_ = sock.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(code, reason), time.Now().Add(time.Second))
}
