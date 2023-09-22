package routes

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/danielzfranklin/plantopo/api/logger"
	"github.com/danielzfranklin/plantopo/api/types"
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
		writeMethodNotAllowed(w)
	}
}

type sessionReply struct {
	User *types.User `json:"user"`
}

func (s *Services) getSessionHandler(w http.ResponseWriter, r *http.Request) {
	l := logger.FromR(r)
	session, err := s.SessionManager.Get(r)
	if err != nil {
		writeInternalError(w, err)
		return
	}

	if session == nil {
		l.Info("no session")
		writeData(w, sessionReply{})
		return
	}

	user, err := s.Users.Get(r.Context(), session.UserId)
	if err != nil {
		if errors.Is(err, users.ErrNotFound) {
			l.Info("session user not found ", zap.String("userId", user.Id.String()))
			s.SessionManager.Delete(r, w)
			writeData(w, sessionReply{})
			return
		} else {
			writeInternalError(w, err)
			return
		}
	}

	l.Info("got session", zap.String("userId", user.Id.String()))
	writeData(w, sessionReply{user})
}

type createSessionRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (s *Services) postSessionHandler(w http.ResponseWriter, r *http.Request) {
	var req createSessionRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		writeBadRequest(w)
		return
	}

	user, err := s.Users.CheckLogin(r.Context(), users.LoginRequest{
		Email:    req.Email,
		Password: req.Password,
	})

	if err != nil {
		var errLoginIssue *users.ErrLoginIssue
		if errors.As(err, &errLoginIssue) {
			writeError(w, &ErrorReply{
				Code:    http.StatusUnauthorized,
				Reason:  "badField",
				Details: errLoginIssue,
			})
			return
		} else {
			writeInternalError(w, err)
			return
		}
	}

	err = s.SessionManager.Create(r, w, user.Id)
	if err != nil {
		writeInternalError(w, err)
		return
	}

	logger.FromR(r).Sugar().Info("created session", "userId", user.Id)
	writeData(w, sessionReply{user})
}

func (s *Services) deleteSessionHandler(w http.ResponseWriter, r *http.Request) {
	sess, err := s.SessionManager.Delete(r, w)
	if err != nil {
		writeInternalError(w, err)
		return
	}
	if sess != nil {
		logger.FromR(r).Sugar().Info("deleted session", "userId", sess.UserId)
	}
	writeData(w, nil)
}
