package routes

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/danielzfranklin/plantopo/api/anon_name"
	"github.com/danielzfranklin/plantopo/api/logger"
	"github.com/danielzfranklin/plantopo/api/map_sync"
	"github.com/danielzfranklin/plantopo/api/maps"
	"github.com/danielzfranklin/plantopo/api/sync_schema"
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
		writeError(w, &ErrorReply{
			Code:    status,
			Reason:  "websocketError",
			Message: reason.Error(),
		})
	},
}

func (s *Services) mapSyncSocketHandler(w http.ResponseWriter, r *http.Request) {
	mapId, err := uuid.Parse(mux.Vars(r)["id"])
	if err != nil {
		writeBadRequest(w)
		return
	}

	clientId, err := uuid.Parse(r.URL.Query().Get("clientId"))
	if err != nil {
		writeBadRequest(w)
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
		writeInternalError(w, err)
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
			writeError(w, &ErrorReply{
				Code:    http.StatusNotFound,
				Reason:  "notFound",
				Message: "Map does not exist",
			})
			return
		} else {
			writeInternalError(w, err)
			return
		}
	}

	if !authz.CanView {
		if userId == uuid.Nil {
			writeError(w, &ErrorReply{
				Code:    http.StatusUnauthorized,
				Reason:  "unauthorized",
				Message: "You must be logged in to view this map",
			})
			return
		} else {
			writeError(w, &ErrorReply{
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
			writeInternalError(w, err)
			return
		}
		trustedAware.Name = user.FullName
	}

	l.Info("upgrading")
	sock, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		// Upgrader handles writing the error
		return
	}
	l.Info("upgraded")

	outgoing := make(chan map_sync.OutgoingSessionMsg, 16)
	sync, err := s.Matchmaker.Connect(r.Context(), mapId, clientId, outgoing)
	var errShouldTrySpecific map_sync.ErrShouldTrySpecific
	if errors.As(err, &errShouldTrySpecific) {
		payload, err := json.Marshal(errShouldTrySpecific)
		if err != nil {
			panic(err)
		}
		l.Info("rejecting", zap.Error(errShouldTrySpecific))
		sock.WriteControl(
			websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.CloseTryAgainLater, string(payload)),
			time.Now().Add(time.Second*60),
		)
		sock.Close()
		return
	} else if err != nil {
		sock.Close()
		l.Error("Matchmaker.Connect error", zap.Error(err))
		panic(err)
	}

	l.Info("accepted")

	// Note gorilla supports one concurrent reader and one concurrent writer
	writerCtx, cancelWriter := context.WithCancel(context.Background())
	go socketReader(l, sync, sock, trustedAware, cancelWriter)
	go socketWriter(writerCtx, l, outgoing, sock)
}

func socketReader(
	l *zap.SugaredLogger,
	sync *map_sync.Connection,
	sock *websocket.Conn,
	trustedAware sync_schema.TrustedAware,
	cancelWriter func(),
) {
	l = l.Named("socketReader")
	defer func() {
		l.Info("closing")
		l.Debug("cancelling writer")
		cancelWriter()
		l.Debug("disconnecting from session")
		sync.Disconnect()
	}()
	for {
		var msg map_sync.IncomingSessionMsg

		err := sock.ReadJSON(&msg)
		if err != nil {
			l.Info("socket read error", zap.Error(err))
			return
		}

		msg.Aware.Trusted = trustedAware

		sync.Incoming <- msg
	}
}

func socketWriter(
	ctx context.Context,
	l *zap.SugaredLogger,
	outgoing chan map_sync.OutgoingSessionMsg,
	sock *websocket.Conn,
) {
	l = l.Named("socketWriter")
	defer func() {
		l.Info("closing")
		l.Debug("closing socket")
		sock.Close()
	}()
	for {
		select {
		case <-ctx.Done():
			l.Debugw("context done", zap.Error(ctx.Err()))
			return
		case msg := <-outgoing:
			err := sock.WriteJSON(msg)
			if err != nil {
				l.Info("socket write error", "error", err)
				return
			}
		}
	}
}
