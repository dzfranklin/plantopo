package routes

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/danielzfranklin/plantopo/api_server/internal/maps"
	"github.com/danielzfranklin/plantopo/api_server/internal/mapsync"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"net/http"
)

type MapImporter interface {
	CreateImport(ctx context.Context, req *mapsync.CreateImportRequest) (*mapsync.Import, error)
	StartImport(importId string) (*mapsync.Import, error)
	CheckImport(ctx context.Context, importId string) (*mapsync.Import, error)
}

func (s *Services) uploadImportHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		writeMethodNotAllowed(r, w)
		return
	}

	mapId := mux.Vars(r)["mapId"]

	sess, err := s.SessionManager.Get(r)
	if err != nil {
		writeError(r, w, err)
		return
	}
	var userId uuid.UUID
	if sess != nil {
		userId = sess.UserId
	}

	if !s.Maps.IsAuthorized(r.Context(),
		maps.AuthzRequest{UserId: userId, MapId: mapId},
		maps.ActionEdit,
	) {
		writeForbidden(r, w)
		return
	}
	var req *mapsync.CreateImportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeBadRequest(r, w)
		return
	}
	defer r.Body.Close()
	req.MapId = mapId

	status, err := s.MapImporter.CreateImport(r.Context(), req)
	if err != nil {
		writeError(r, w, err)
		return
	}

	writeData(r, w, status)
}

func (s *Services) startImportHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		writeMethodNotAllowed(r, w)
		return
	}

	vars := mux.Vars(r)
	mapId, ok := vars["mapId"]
	if !ok {
		writeBadRequest(r, w)
		return
	}
	importId, ok := vars["importId"]
	if !ok {
		writeBadRequest(r, w)
		return
	}

	status, err := s.MapImporter.CheckImport(r.Context(), importId)
	if err != nil {
		if errors.Is(err, mapsync.ImportNotFound) {
			writeNotFound(r, w)
		} else {
			writeError(r, w, err)
		}
		return
	}
	if status.MapId != mapId {
		writeNotFound(r, w)
		return
	}

	status, err = s.MapImporter.StartImport(importId)
	if err != nil {
		if errors.Is(err, mapsync.ImportNotFound) {
			writeNotFound(r, w)
		} else {
			writeError(r, w, err)
		}
		return
	}
	writeData(r, w, status)
}

func (s *Services) checkImportHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		writeMethodNotAllowed(r, w)
		return
	}
	vars := mux.Vars(r)
	mapId, ok := vars["mapId"]
	if !ok {
		writeBadRequest(r, w)
		return
	}
	importId, ok := vars["importId"]
	if !ok {
		writeBadRequest(r, w)
		return
	}

	status, err := s.MapImporter.CheckImport(r.Context(), importId)
	if err != nil {
		if errors.Is(err, mapsync.ImportNotFound) {
			writeNotFound(r, w)
		} else {
			writeError(r, w, err)
		}
		return
	}
	if status.MapId != mapId {
		writeNotFound(r, w)
		return
	}

	writeData(r, w, status)
}
