package routes

import (
	"context"
	"encoding/json"
	"github.com/danielzfranklin/plantopo/api_server/internal/maps"
	"github.com/danielzfranklin/plantopo/api_server/internal/mapsync"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"net/http"
	"strings"
)

type MapExporter interface {
	Export(ctx context.Context, mapId string, info mapsync.ExportInfo) (string, error)
}

type mapExportRequest struct {
	Format string `json:"format"`
}

type mapExportResponse struct {
	URL string `json:"url"`
}

func (s *Services) mapExportHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMethodNotAllowed(r, w)
		return
	}

	var req mapExportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeBadRequest(r, w)
		return
	}

	mapId := mux.Vars(r)["id"]
	userId, err := s.SessionManager.GetUserId(r)
	if err != nil {
		writeInternalError(r, w, err)
		return
	}

	if !s.Maps.IsAuthorized(r.Context(), maps.AuthzRequest{UserId: userId, MapId: mapId}, maps.ActionView) {
		if userId == uuid.Nil {
			writeUnauthorized(r, w)
		} else {
			writeForbidden(r, w)
		}
		return
	}

	meta, err := s.Maps.Get(r.Context(), mapId)
	if err != nil {
		writeInternalError(r, w, err)
		return
	}

	name := meta.Name
	if name == "" {
		name = "Unnamed map"
	}
	exportFilename := strings.ReplaceAll(name, "/", "_") + "." + req.Format

	url, err := s.MapExporter.Export(r.Context(), meta.Id, mapsync.ExportInfo{
		Format:   req.Format,
		Name:     name,
		Filename: exportFilename,
	})
	if err != nil {
		writeError(r, w, err)
		return
	}

	writeData(r, w, &mapExportResponse{URL: url})
}
