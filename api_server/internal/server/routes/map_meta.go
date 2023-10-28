package routes

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/danielzfranklin/plantopo/api_server/internal/maps"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

func (s *Services) mapsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "POST":
		s.postMapsHandler(w, r)
	case "DELETE":
		s.deleteMapsHandler(w, r)
	default:
		writeMethodNotAllowed(w)
	}
}

func (s *Services) postMapsHandler(w http.ResponseWriter, r *http.Request) {
	sess, err := s.SessionManager.Get(r)
	if err != nil {
		writeError(w, err)
		return
	} else if sess == nil {
		writeUnauthorized(w)
		return
	}

	meta, err := s.Maps.Create(r.Context(), sess.UserId)
	if err != nil {
		writeInternalError(w, err)
		return
	}

	writeData(w, meta)
}

type deleteRequest struct {
	List []string `json:"list"`
}

func (s *Services) deleteMapsHandler(w http.ResponseWriter, r *http.Request) {
	sess, err := s.SessionManager.Get(r)
	if err != nil {
		writeError(w, err)
		return
	} else if sess == nil {
		writeUnauthorized(w)
		return
	}

	var req deleteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeBadRequest(w)
		return
	}

	for _, id := range req.List {
		if !s.Maps.IsAuthorized(r.Context(),
			maps.AuthzRequest{UserId: sess.UserId, MapId: id},
			maps.ActionDelete,
		) {
			writeForbidden(w)
			return
		}
	}

	if err := s.Maps.Delete(r.Context(), req.List); err != nil {
		writeInternalError(w, err)
		return
	}

	writeData(w, nil)
}

func (s *Services) mapHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		s.getMapHandler(w, r)
	case "PUT":
		s.putMapHandler(w, r)
	default:
		writeMethodNotAllowed(w)
	}
}

type mapMetaDto struct {
	Id                    uuid.UUID `json:"id"`
	Name                  string    `json:"name"`
	CreatedAt             time.Time `json:"createdAt"`
	CurrentSessionMayEdit bool      `json:"currentSessionMayEdit"`
}

func (s *Services) getMapHandler(w http.ResponseWriter, r *http.Request) {
	sess, err := s.SessionManager.Get(r)
	if err != nil {
		writeInternalError(w, err)
		return
	}

	mapId := mux.Vars(r)["id"]

	// Fetch before authorizing so we can return a 404 if the map doesn't exist.
	data, err := s.Maps.Get(r.Context(), mapId)
	if errors.Is(err, maps.ErrMapNotFound) {
		writeNotFound(w)
		return
	} else if err != nil {
		writeInternalError(w, err)
		return
	}

	authzReq := maps.AuthzRequest{MapId: mapId}
	if sess != nil {
		authzReq.UserId = sess.UserId
	}
	if !s.Maps.IsAuthorized(r.Context(), authzReq, maps.ActionView) {
		if sess == nil {
			writeUnauthorized(w)
			return
		} else {
			writeForbidden(w)
			return
		}
	}

	sessionMayEdit := s.Maps.IsAuthorized(r.Context(), authzReq, maps.ActionEdit)

	writeData(w, mapMetaDto{
		Id:                    data.Id,
		Name:                  data.Name,
		CreatedAt:             data.CreatedAt,
		CurrentSessionMayEdit: sessionMayEdit,
	})
}

func (s *Services) putMapHandler(w http.ResponseWriter, r *http.Request) {
	sess, err := s.SessionManager.Get(r)
	if err != nil {
		writeInternalError(w, err)
		return
	} else if sess == nil {
		writeUnauthorized(w)
		return
	}

	mapId := mux.Vars(r)["id"]

	var req maps.MetaUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeBadRequest(w)
		return
	}
	req.Id = mapId

	if !s.Maps.IsAuthorized(r.Context(),
		maps.AuthzRequest{UserId: sess.UserId, MapId: mapId},
		maps.ActionEdit,
	) {
		writeForbidden(w)
		return
	}

	data, err := s.Maps.Put(r.Context(), req)
	if errors.Is(err, maps.ErrMapNotFound) {
		writeNotFound(w)
		return
	} else if err != nil {
		writeInternalError(w, err)
		return
	}

	writeData(w, mapMetaDto{
		Id:                    data.Id,
		Name:                  data.Name,
		CreatedAt:             data.CreatedAt,
		CurrentSessionMayEdit: true, // checked above
	})
}

func (s *Services) mapAccessHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		s.getMapAccessHandler(w, r)
	case "PUT":
		s.putMapAccessHandler(w, r)
	default:
		writeMethodNotAllowed(w)
	}
}

func (s *Services) getMapAccessHandler(w http.ResponseWriter, r *http.Request) {
	sess, err := s.SessionManager.Get(r)
	if err != nil {
		writeInternalError(w, err)
		return
	} else if sess == nil {
		writeUnauthorized(w)
		return
	}

	mapId := mux.Vars(r)["id"]

	if !s.Maps.IsAuthorized(r.Context(),
		maps.AuthzRequest{UserId: sess.UserId, MapId: mapId},
		maps.ActionViewAccess,
	) {
		writeForbidden(w)
		return
	}

	value, err := s.Maps.Access(r.Context(), mapId)
	if errors.Is(err, maps.ErrMapNotFound) {
		writeNotFound(w)
		return
	}

	writeData(w, value)
}

func (s *Services) putMapAccessHandler(w http.ResponseWriter, r *http.Request) {
	sess, err := s.SessionManager.Get(r)
	if err != nil {
		writeInternalError(w, err)
		return
	} else if sess == nil {
		writeUnauthorized(w)
		return
	}

	user, err := sess.GetUser()
	if err != nil {
		writeInternalError(w, err)
		return
	}

	mapId := mux.Vars(r)["id"]

	var req maps.PutAccessRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeBadRequest(w)
		return
	}
	req.MapId = mapId

	if !s.Maps.IsAuthorized(r.Context(),
		maps.AuthzRequest{UserId: sess.UserId, MapId: mapId},
		maps.ActionShare,
	) {
		writeForbidden(w)
		return
	}

	if err := s.Maps.PutAccess(r.Context(), user, req); err != nil {
		if errors.Is(err, maps.ErrMapNotFound) {
			writeError(w, &ErrorReply{
				Code:    http.StatusNotFound,
				Message: "map not found",
			})
			return
		} else {
			writeInternalError(w, err)
			return
		}
	}

	fmt.Println("calling access")
	updatedValue, err := s.Maps.Access(r.Context(), mapId)
	fmt.Println("called access")
	if errors.Is(err, maps.ErrMapNotFound) {
		writeNotFound(w)
		return
	} else if err != nil {
		writeInternalError(w, err)
		return
	}

	writeData(w, updatedValue)
}
