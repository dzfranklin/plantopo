package routes

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/danielzfranklin/plantopo/api_server/internal/loggers"
	"github.com/danielzfranklin/plantopo/api_server/internal/users"
)

type accountConfirmCompleteRequest struct {
	Token string `json:"token"`
}

func (s *Services) accountConfirmCompleteHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		writeMethodNotAllowed(r, w)
		return
	}

	var req accountConfirmCompleteRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		writeBadRequest(r, w)
		return
	}

	userId, err := s.Users.Confirm(req.Token)
	if err != nil {
		if errors.Is(err, users.ErrNotFound) {
			writeError(r, w, &ErrorReply{
				Code:   http.StatusBadRequest,
				Reason: "tokenInvalid",
			})
			return
		} else if errors.Is(err, users.ErrTokenExpired) {
			writeError(r, w, &ErrorReply{
				Code:   http.StatusForbidden,
				Reason: "tokenExpired",
			})
			return
		} else if errors.Is(err, users.ErrTokenUsed) {
			writeError(r, w, &ErrorReply{
				Code:   http.StatusForbidden,
				Reason: "tokenUsed",
			})
			return
		} else {
			writeInternalError(r, w, err)
			return
		}
	}

	user, err := s.Users.Get(r.Context(), userId)
	if err != nil {
		writeInternalError(r, w, err)
		return
	}

	if err := s.SessionManager.Create(r, w, user.Id); err != nil {
		writeInternalError(r, w, err)
		return
	}
	loggers.FromR(r).Sugar().Info("created session for confirmed user", "userId", user.Id)
	writeData(r, w, sessionReply{user})
}

type accountConfirmRerequestRequest struct {
	Email string `json:"email"`
}

func (s *Services) accountConfirmRerequestHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		writeMethodNotAllowed(r, w)
		return
	}

	var req accountConfirmRerequestRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		writeBadRequest(r, w)
		return
	}

	err = s.Users.RerequestConfirmation(req.Email)
	if err != nil {
		if errors.Is(err, users.ErrNotFound) {
			writeError(r, w, &ErrorReply{
				Code:    http.StatusBadRequest,
				Reason:  "emailInvalid",
				Message: "email not found",
			})
			return
		} else {
			writeInternalError(r, w, err)
			return
		}
	}

	writeData(r, w, nil)
}
