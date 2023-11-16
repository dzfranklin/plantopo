package routes

import (
	"context"
	"encoding/json"
	"errors"
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

type SyncerConnection interface {
	SendUpdate(update *api.SyncBackendIncomingUpdate) error
	Recv() (*api.SyncBackendOutgoingMessage, error)
	Close()
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
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

	// The browser doesn't send a preflight request to authorize websockets
	origin := r.Header.Get("Origin")
	if origin == "" || !isPermittedOrigin(origin) {
		writeError(r, w, &ErrorReply{
			Code:    http.StatusForbidden,
			Message: "bad origin",
		})
		return
	}

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

	b, err := s.SyncConnector(r.Context(), clientId, mapId)
	if err != nil {
		writeInternalError(r, w, err)
		return
	}

	l.Info("upgrading")
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		// Upgrader handles writing the error
		b.Close()
		return
	}
	l.Info("upgraded")

	state := &sockState{
		l:       l,
		conn:    conn,
		b:       b,
		mayEdit: authz.CanEdit,

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
	l    *zap.SugaredLogger
	conn *websocket.Conn
	b    SyncerConnection

	mayEdit      bool
	trustedAware sync_schema.TrustedAware
}

func socketReader(
	s *sockState,
) {
	errCode := websocket.CloseInternalServerErr
	var err error
	defer func() {
		if err != nil {
			s.l.Warnw("closing socketReader due to error", zap.Error(err))
			writeCloseMessage(s.conn, errCode, err.Error())
		} else {
			s.l.Info("closing socketReader")
			writeCloseMessage(s.conn, websocket.CloseNormalClosure, "")
		}
		_ = s.conn.Close()
		s.b.Close()
	}()
	for {
		var msg incomingDto
		err = s.conn.ReadJSON(&msg)
		if err != nil {
			if errors.Is(err, &websocket.CloseError{}) {
				err = nil
				return
			}
			errCode = websocket.CloseProtocolError
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
		if s.mayEdit {
			change, err = json.Marshal(msg.Change)
			if err != nil {
				return
			}
		} else if msg.Change != nil {
			err = errors.New("not authorized to send changes")
			errCode = websocket.ClosePolicyViolation
			return
		}

		err = s.b.SendUpdate(&api.SyncBackendIncomingUpdate{
			Seq:    msg.Seq,
			Aware:  aware,
			Change: change,
		})
		if err != nil {
			return
		}
	}
}

type outgoingDto struct {
	Ack                 int32           `json:"ack,omitempty"`
	InitialLoadComplete bool            `json:"initialLoadComplete,omitempty"`
	Aware               json.RawMessage `json:"aware,omitempty"`
	Change              json.RawMessage `json:"change,omitempty"`
	Error               string          `json:"error,omitempty"`
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
		s.b.Close()
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
			Ack:                 msg.Ack,
			InitialLoadComplete: msg.InitialLoadComplete,
			Aware:               msg.Aware,
			Change:              msg.Change,
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
