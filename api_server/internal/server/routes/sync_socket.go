package routes

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/danielzfranklin/plantopo/api/sync_schema"
	api "github.com/danielzfranklin/plantopo/api/v1"
	"github.com/danielzfranklin/plantopo/api_server/internal/anon_name"
	"github.com/danielzfranklin/plantopo/api_server/internal/logger"
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
		for _, allowed := range allowedOrigins {
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

	l := logger.FromCtx(r.Context()).Sugar().With(
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
		} else {
			writeInternalError(r, w, err)
			return
		}
	}

	if !authz.CanView {
		if userId == uuid.Nil {
			writeError(r, w, &ErrorReply{
				Code:    http.StatusUnauthorized,
				Reason:  "unauthorized",
				Message: "You must be logged in to view this map",
			})
			return
		} else {
			writeError(r, w, &ErrorReply{
				Code:    http.StatusForbidden,
				Reason:  "forbidden",
				Message: "You do not have permission to view this map",
			})
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
		writeInternalError(r, w, err)
		return
	}
	l = l.With("backend", resp.Backend)

	l.Info("connecting to backend")
	bClient, err := s.SyncBackends.Dial(resp.Backend)
	if err != nil {
		writeInternalError(r, w,
			fmt.Errorf("failed to dial backend (%s): %w", resp.Backend, err))
		return
	}
	bCtx, cancelB := context.WithCancel(context.Background())
	b, err := bClient.Connect(bCtx)
	if err != nil {
		writeInternalError(r, w,
			fmt.Errorf("failed to connect to backend %s: %s", resp.Backend, err))
		cancelB()
		return
	}
	l.Info("sending connect to backend")
	err = b.Send(&api.SyncBackendIncomingMessage{
		Msg: &api.SyncBackendIncomingMessage_Connect{
			Connect: &api.SyncBackendConnectRequest{
				MapId:        mapId,
				Token:        resp.Token,
				ConnectionId: clientId,
			},
		},
	})
	if err != nil {
		writeInternalError(r, w,
			fmt.Errorf("failed to send connect to backend %s: %s", resp.Backend, err))
		cancelB()
		return
	}

	l.Info("upgrading")
	sock, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		// Upgrader handles writing the error
		cancelB()
		return
	}
	l.Info("upgraded")

	go socketReader(l, sock, b, cancelB, trustedAware)
	go socketWriter(l, sock, b)
}

type Incoming struct {
	Seq    int32                  `json:"seq"`
	Aware  *sync_schema.Aware     `json:"aware"`
	Change *sync_schema.Changeset `json:"change"`
}

func socketReader(
	l *zap.SugaredLogger,
	sock *websocket.Conn,
	b api.SyncBackend_ConnectClient,
	cancelB func(),
	trustedAware sync_schema.TrustedAware,
) {
	l = l.Named("socketReader")
	defer func() {
		l.Info("closing")
		_ = sock.Close()
		cancelB()
	}()
	for {
		var msg Incoming
		err := sock.ReadJSON(&msg)
		if err != nil {
			l.Infow("socket read error", zap.Error(err))
			return
		}

		var aware []byte
		if msg.Aware != nil {
			msg.Aware.Trusted = trustedAware
			aware, err = json.Marshal(msg.Aware)
			if err != nil {
				l.DPanicw("failed to marshal aware", zap.Error(err))
				return
			}
		}

		change, err := json.Marshal(msg.Change)
		if err != nil {
			l.DPanicw("failed to marshal change", zap.Error(err))
			return
		}

		err = b.Send(&api.SyncBackendIncomingMessage{
			Msg: &api.SyncBackendIncomingMessage_Update{
				Update: &api.SyncBackendIncomingUpdate{
					Seq:    msg.Seq,
					Aware:  aware,
					Change: change,
				},
			},
		})
		if err != nil {
			l.Infow("backend send error", zap.Error(err))
			writeCloseMessage(sock, websocket.CloseInternalServerErr, "failed to send to backend")
			return
		}
	}
}

func socketWriter(
	l *zap.SugaredLogger,
	sock *websocket.Conn,
	b api.SyncBackend_ConnectClient,
) {
	l = l.Named("socketWriter")
	defer func() {
		l.Info("closing")
		_ = sock.Close()
	}()
	for {
		msg, err := b.Recv()
		if err != nil {
			if errors.Is(err, context.Canceled) {
				l.Info("cancelled")
				writeCloseMessage(sock, websocket.CloseNormalClosure, "cancelled")
				return
			} else {
				l.Infow("backend recv error", zap.Error(err))
				writeCloseMessage(sock, websocket.CloseInternalServerErr, "failed to receive from backend")
				return
			}
		}

		err = sock.WriteMessage(websocket.TextMessage, msg.Data)
		if err != nil {
			l.Infow("socket write error", zap.Error(err))
			return
		}
	}
}

func writeCloseMessage(sock *websocket.Conn, code int, reason string) {
	_ = sock.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(code, reason), time.Now().Add(time.Second))
}
