package routes

import (
	"context"
	"encoding/json"
	"errors"
	schema "github.com/danielzfranklin/plantopo/api/sync_schema"
	"github.com/danielzfranklin/plantopo/api_server/internal/maps"
	"github.com/danielzfranklin/plantopo/api_server/internal/snapshot_repo"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"net/http"
	"os"
)

var backendToken = os.Getenv("BACKEND_TOKEN")

type SnapshotRepo interface {
	GetMapSnapshotGzipped(ctx context.Context, mapId string) ([]byte, error)
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

	snapshot, err := s.SnapshotRepo.GetMapSnapshotGzipped(r.Context(), mapId)
	if err != nil {
		if errors.Is(err, snapshot_repo.ErrSnapshotNotFound) {
			writeNotFound(r, w)
			return
		}
		writeError(r, w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Encoding", "gzip")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(snapshot)
}

func (s *Services) putMapSnapshotHandler(w http.ResponseWriter, r *http.Request) {
	mapId, ok := mux.Vars(r)["id"]
	if !ok {
		writeBadRequest(r, w)
		return
	}

	permit := false
	authzHeader := r.Header.Get("Authorization")
	if authzHeader != "" && backendToken != "" {
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
