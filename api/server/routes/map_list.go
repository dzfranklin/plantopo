package routes

import (
	"net/http"

	"github.com/danielzfranklin/plantopo/api/types"
)

type listReply struct {
	Items []types.MapMeta `json:"items"`
}

func (s *Services) mapListOwnedByMeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		writeMethodNotAllowed(w)
		return
	}

	session, err := s.SessionManager.Get(r)
	if err != nil {
		writeInternalError(w, err)
		return
	}
	if session == nil {
		writeUnauthorized(w)
		return
	}

	list, err := s.Maps.ListOwnedBy(r.Context(), session.UserId)
	if err != nil {
		writeInternalError(w, err)
		return
	}

	writeData(w, listReply{list})
}

func (s *Services) mapListSharedWithMeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		writeMethodNotAllowed(w)
		return
	}

	session, err := s.SessionManager.Get(r)
	if err != nil {
		writeInternalError(w, err)
		return
	}
	if session == nil {
		writeUnauthorized(w)
		return
	}

	list, err := s.Maps.ListSharedWith(r.Context(), session.UserId)
	if err != nil {
		writeInternalError(w, err)
		return
	}

	writeData(w, listReply{list})
}
