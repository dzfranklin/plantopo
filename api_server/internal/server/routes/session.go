package routes

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/danielzfranklin/plantopo/api_server/internal/loggers"
	"github.com/danielzfranklin/plantopo/api_server/internal/types"
	"github.com/danielzfranklin/plantopo/api_server/internal/users"
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
		writeMethodNotAllowed(r, w)
	}
}

type sessionReply struct {
	User *types.User `json:"user"`
}

func (s *Services) getSessionHandler(w http.ResponseWriter, r *http.Request) {
	l := loggers.FromR(r)
	session, err := s.SessionManager.Get(r)
	if err != nil {
		writeInternalError(r, w, err)
		return
	}

	if session == nil {
		l.Info("no session")
		writeData(r, w, sessionReply{})
		return
	}

	user, err := s.Users.Get(r.Context(), session.UserId)
	if err != nil {
		if errors.Is(err, users.ErrNotFound) {
			l.Info("session user not found ", zap.String("userId", user.Id.String()))
			_, _ = s.SessionManager.Delete(r, w)
			writeData(r, w, sessionReply{})
			return
		} else {
			writeInternalError(r, w, err)
			return
		}
	}

	l.Info("got session", zap.String("userId", user.Id.String()))
	writeData(r, w, sessionReply{user})
}

type createSessionRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (s *Services) postSessionHandler(w http.ResponseWriter, r *http.Request) {
	var req createSessionRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		writeBadRequest(r, w)
		return
	}

	user, err := s.Users.CheckLogin(r.Context(), users.LoginRequest{
		Email:    req.Email,
		Password: req.Password,
	})

	if err != nil {
		var errLoginIssue *users.ErrLoginIssue
		if errors.As(err, &errLoginIssue) {
			writeError(r, w, &ErrorReply{
				Code:    http.StatusUnauthorized,
				Reason:  "badField",
				Details: errLoginIssue,
			})
			return
		} else {
			writeInternalError(r, w, err)
			return
		}
	}

	err = s.SessionManager.Create(r, w, user.Id)
	if err != nil {
		writeInternalError(r, w, err)
		return
	}

	loggers.FromR(r).Sugar().Info("created session", "userId", user.Id)
	writeData(r, w, sessionReply{user})
}

func (s *Services) deleteSessionHandler(w http.ResponseWriter, r *http.Request) {
	sess, err := s.SessionManager.Delete(r, w)
	if err != nil {
		writeInternalError(r, w, err)
		return
	}
	if sess != nil {
		loggers.FromR(r).Sugar().Info("deleted session", "userId", sess.UserId)
	}
	writeData(r, w, nil)
}
