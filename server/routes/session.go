package routes

import (
	"encoding/json"
	"net/http"

	"github.com/danielzfranklin/plantopo/logger"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

func (s *Services) sessionHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		s.getSessionHandler(w, r)
	case "POST":
		s.postSessionHandler(w, r)
	case "DELETE":
		s.deleteSessionHandler(w, r)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

type getReply struct {
	UserId uuid.UUID `json:"userId"`
}

func (s *Services) getSessionHandler(w http.ResponseWriter, r *http.Request) {
	l := logger.FromCtx(r.Context()).Named("getSessionHandler")
	session, err := s.SessionManager.Get(r)
	if err != nil {
		l.Error("failed to get session", zap.Error(err))
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	if session == nil {
		w.WriteHeader(http.StatusNotFound)
		return
	}

	out, err := json.Marshal(getReply{session.UserId})
	if err != nil {
		l.Error("failed to marshal json", zap.Error(err))
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(out)
	w.Write([]byte("\n"))
}

type postRequest struct {
	UserId uuid.UUID `json:"userId"`
	// TODO: username and password
}

type postReply struct {
	UserId uuid.UUID `json:"userId"`
}

func (s *Services) postSessionHandler(w http.ResponseWriter, r *http.Request) {
	l := logger.FromCtx(r.Context()).Named("postSessionHandler")

	var req postRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		l.Info("failed to decode json", zap.Error(err))
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	err = s.SessionManager.Create(r, w, req.UserId)
	if err != nil {
		l.Error("failed to create session", zap.Error(err))
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	l.Info("created session", zap.String("userId", req.UserId.String()))

	out, err := json.Marshal(postReply{req.UserId})
	if err != nil {
		l.Error("failed to marshal json", zap.Error(err))
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(out)
	w.Write([]byte("\n"))
}

func (s *Services) deleteSessionHandler(w http.ResponseWriter, r *http.Request) {
	l := logger.FromCtx(r.Context()).Named("deleteSessionHandler")
	err := s.SessionManager.Delete(r, w)
	if err != nil {
		l.Error("failed to delete session", zap.Error(err))
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
}
