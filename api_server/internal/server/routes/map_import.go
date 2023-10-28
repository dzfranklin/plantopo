package routes

import (
	"encoding/json"
	"errors"
	"github.com/danielzfranklin/plantopo/api_server/internal/importers"
	"github.com/danielzfranklin/plantopo/api_server/internal/maps"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"net/http"
)

type importRequest struct {
	Format string `json:"format"`
}

func (s *Services) uploadImportHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		writeMethodNotAllowed(w)
		return
	}

	mapId := mux.Vars(r)["mapId"]

	sess, err := s.SessionManager.Get(r)
	if err != nil {
		writeError(w, err)
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
		writeForbidden(w)
		return
	}
	var req importRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeBadRequest(w)
		return
	}

	if req.Format != "gpx" {
		writeBadRequest(w)
		return
	}

	status, err := s.MapImporter.CreateImport(r.Context(), mapId, req.Format)
	if err != nil {
		writeError(w, err)
		return
	}

	writeData(w, status)
}

func (s *Services) startImportHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		writeMethodNotAllowed(w)
		return
	}

	vars := mux.Vars(r)
	mapId, err := uuid.Parse(vars["mapId"])
	if err != nil {
		writeBadRequest(w)
		return
	}
	importId, ok := vars["importId"]
	if !ok {
		writeBadRequest(w)
		return
	}

	status, err := s.MapImporter.CheckImport(r.Context(), importId)
	if err != nil {
		if errors.Is(err, importers.ErrNotFound) {
			writeNotFound(w)
		} else {
			writeError(w, err)
		}
		return
	}
	if status.MapId != mapId {
		writeNotFound(w)
		return
	}

	status, err = s.MapImporter.StartImport(importId)
	if err != nil {
		if errors.Is(err, importers.ErrNotFound) {
			writeNotFound(w)
		} else {
			writeError(w, err)
		}
		return
	}
	writeData(w, status)
}

func (s *Services) checkImportHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		writeMethodNotAllowed(w)
		return
	}
	vars := mux.Vars(r)
	mapId, err := uuid.Parse(vars["mapId"])
	if err != nil {
		writeBadRequest(w)
		return
	}
	importId, ok := vars["importId"]
	if !ok {
		writeBadRequest(w)
		return
	}

	status, err := s.MapImporter.CheckImport(r.Context(), importId)
	if err != nil {
		if errors.Is(err, importers.ErrNotFound) {
			writeNotFound(w)
		} else {
			writeError(w, err)
		}
		return
	}
	if status.MapId != mapId {
		writeNotFound(w)
		return
	}

	writeData(w, status)
}
