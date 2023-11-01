package routes

import (
	"context"
	"encoding/json"
	schema "github.com/danielzfranklin/plantopo/api/sync_schema"
	"github.com/danielzfranklin/plantopo/api_server/internal/maps"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"net/http"
	"os"
)

var backendToken = os.Getenv("BACKEND_TOKEN")

type SnapshotRepo interface {
	GetMapSnapshot(ctx context.Context, mapId string) (schema.Changeset, error)
	SetMapSnapshot(ctx context.Context, mapId string, value schema.Changeset) error
}

func (s *Services) mapSnapshotHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		s.getMapSnapshotHandler(w, r)
	case "PUT":
		s.putMapSnapshotHandler(w, r)
	default:
		writeMethodNotAllowed(r, w)
	}
}

func (s *Services) getMapSnapshotHandler(w http.ResponseWriter, r *http.Request) {
	mapId, ok := mux.Vars(r)["id"]
	if !ok {
		writeBadRequest(r, w)
		return
	}

	permit := false
	authzHeader := r.Header.Get("Authorization")
	if authzHeader != "" {
		permit = authzHeader == "Bearer "+backendToken
	} else {
		sess, err := s.SessionManager.Get(r)
		if err != nil {
			writeError(r, w, err)
			return
		}
		var userId uuid.UUID
		if sess != nil {
			userId = sess.UserId
		}
		permit = s.Maps.IsAuthorized(r.Context(), maps.AuthzRequest{UserId: userId, MapId: mapId}, maps.ActionView)
	}
	if !permit {
		writeForbidden(r, w)
		return
	}

	snapshot, err := s.SnapshotRepo.GetMapSnapshot(r.Context(), mapId)
	if err != nil {
		writeError(r, w, err)
		return
	}
	writeData(r, w, snapshot)
}

func (s *Services) putMapSnapshotHandler(w http.ResponseWriter, r *http.Request) {
	mapId, ok := mux.Vars(r)["id"]
	if !ok {
		writeBadRequest(r, w)
		return
	}

	permit := false
	authzHeader := r.Header.Get("Authorization")
	if authzHeader != "" {
		permit = authzHeader == "Bearer "+backendToken
	} else {
		sess, err := s.SessionManager.Get(r)
		if err != nil {
			writeError(r, w, err)
			return
		}
		var userId uuid.UUID
		if sess != nil {
			userId = sess.UserId
		}
		permit = s.Maps.IsAuthorized(r.Context(), maps.AuthzRequest{UserId: userId, MapId: mapId}, maps.ActionEdit)
	}
	if !permit {
		writeForbidden(r, w)
		return
	}

	var snapshot schema.Changeset
	if err := json.NewDecoder(r.Body).Decode(&snapshot); err != nil {
		writeBadRequest(r, w)
		return
	}

	if err := s.SnapshotRepo.SetMapSnapshot(r.Context(), mapId, snapshot); err != nil {
		writeError(r, w, err)
		return
	}
	writeData(r, w, nil)
}
