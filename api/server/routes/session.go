package routes

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/danielzfranklin/plantopo/api/logger"
	"github.com/danielzfranklin/plantopo/api/user"
	"github.com/danielzfranklin/plantopo/api/users"
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

type userReply struct {
	User *user.User `json:"user"`
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

	user, err := s.Users.Get(r.Context(), session.UserId)
	if err != nil {
		l.Error("failed to get logged in user", zap.Error(err))
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	out, err := json.Marshal(userReply{user})
	if err != nil {
		l.Error("failed to marshal json", zap.Error(err))
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(out)
	w.Write([]byte("\n"))
}

type createSessionRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type createSessionError struct {
	Error *users.ErrLoginIssue `json:"error"`
}

func (s *Services) postSessionHandler(w http.ResponseWriter, r *http.Request) {
	l := logger.FromCtx(r.Context()).Named("postSessionHandler")

	var req createSessionRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		l.Info("failed to decode json", zap.Error(err))
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	user, err := s.Users.CheckLogin(r.Context(), users.LoginRequest{
		Email:    req.Email,
		Password: req.Password,
	})

	if err != nil {
		var errLoginIssue *users.ErrLoginIssue
		if errors.As(err, &errLoginIssue) {
			out, err := json.Marshal(createSessionError{errLoginIssue})
			if err != nil {
				l.Error("failed to marshal json", zap.Error(err))
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			w.Write(out)
			return
		} else {
			l.Error("failed to check login", zap.Error(err))
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
	}

	err = s.SessionManager.Create(r, w, user.Id)
	if err != nil {
		l.Error("failed to create session", zap.Error(err))
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	l.Info("created session", zap.String("userId", user.Id.String()))

	out, err := json.Marshal(userReply{user})
	if err != nil {
		l.Error("failed to marshal json", zap.Error(err))
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(out)
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
