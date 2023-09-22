package routes

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/danielzfranklin/plantopo/api/logger"
	"github.com/danielzfranklin/plantopo/api/users"
)

type accountConfirmCompleteRequest struct {
	Token string `json:"token"`
}

func (s *Services) accountConfirmCompleteHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		writeMethodNotAllowed(w)
		return
	}

	var req accountConfirmCompleteRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		writeBadRequest(w)
		return
	}

	userId, err := s.Users.Confirm(req.Token)
	if err != nil {
		if errors.Is(err, users.ErrNotFound) {
			writeError(w, &ErrorReply{
				Code:   http.StatusBadRequest,
				Reason: "tokenInvalid",
			})
			return
		} else if errors.Is(err, users.ErrTokenExpired) {
			writeError(w, &ErrorReply{
				Code:   http.StatusForbidden,
				Reason: "tokenExpired",
			})
			return
		} else if errors.Is(err, users.ErrTokenUsed) {
			writeError(w, &ErrorReply{
				Code:   http.StatusForbidden,
				Reason: "tokenUsed",
			})
			return
		} else {
			writeInternalError(w, err)
			return
		}
	}

	user, err := s.Users.Get(r.Context(), userId)
	if err != nil {
		writeInternalError(w, err)
		return
	}

	if err := s.SessionManager.Create(r, w, user.Id); err != nil {
		writeInternalError(w, err)
		return
	}
	logger.FromR(r).Sugar().Info("created session for confirmed user", "userId", user.Id)
	writeData(w, sessionReply{user})
}

type accountConfirmRerequestRequest struct {
	Email string `json:"email"`
}

func (s *Services) accountConfirmRerequestHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		writeMethodNotAllowed(w)
		return
	}

	var req accountConfirmRerequestRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		writeBadRequest(w)
		return
	}

	err = s.Users.RerequestConfirmation(req.Email)
	if err != nil {
		if errors.Is(err, users.ErrNotFound) {
			writeError(w, &ErrorReply{
				Code:    http.StatusBadRequest,
				Reason:  "emailInvalid",
				Message: "email not found",
			})
			return
		} else {
			writeInternalError(w, err)
			return
		}
	}

	writeData(w, nil)
}
