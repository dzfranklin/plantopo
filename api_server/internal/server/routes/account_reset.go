package routes

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/danielzfranklin/plantopo/api_server/internal/types"
	"github.com/danielzfranklin/plantopo/api_server/internal/users"
)

type requestPasswordResetRequest struct {
	Email string `json:"email"`
}

func (s *Services) requestPasswordResetHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		writeMethodNotAllowed(r, w)
		return
	}

	var req requestPasswordResetRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		writeBadRequest(r, w)
		return
	}

	err = s.Users.RequestPasswordReset(req.Email)
	if err != nil {
		if errors.Is(err, users.ErrNotFound) {
			writeError(r, w, &ErrorReply{
				Code:    http.StatusBadRequest,
				Reason:  "emailInvalid",
				Message: "not found",
			})
			return
		} else {
			writeInternalError(r, w, err)
			return
		}
	}

	writeData(r, w, nil)
}

type checkPasswordResetRequest struct {
	Token string `json:"token"`
}

type checkPasswordResetReply struct {
	User *types.User `json:"user"`
}

func (s *Services) checkPasswordResetHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		writeMethodNotAllowed(r, w)
		return
	}

	var req checkPasswordResetRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		writeBadRequest(r, w)
		return
	}

	user, err := s.Users.CheckPasswordReset(r.Context(), req.Token)
	if err != nil {
		if errors.Is(err, users.ErrNotFound) {
			writeError(r, w, &ErrorReply{
				Code:    http.StatusBadRequest,
				Reason:  "tokenInvalid",
				Message: "url invalid",
			})
			return
		} else if errors.Is(err, users.ErrTokenUsed) {
			writeError(r, w, &ErrorReply{
				Code:    http.StatusBadRequest,
				Reason:  "tokenUsed",
				Message: "url already used",
			})
			return
		} else if errors.Is(err, users.ErrTokenExpired) {
			writeError(r, w, &ErrorReply{
				Code:    http.StatusBadRequest,
				Reason:  "tokenExpired",
				Message: "url expired",
			})
			return
		} else {
			writeInternalError(r, w, err)
			return
		}
	}

	writeData(r, w, checkPasswordResetReply{User: user})
}

type completePasswordResetRequest struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

func (s *Services) completePasswordResetHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		writeMethodNotAllowed(r, w)
		return
	}

	var req completePasswordResetRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		writeBadRequest(r, w)
		return
	}

	user, err := s.Users.ResetPassword(req.Token, req.Password)
	if err != nil {
		var errPasswordResetIssue *users.ErrPasswordResetIssue
		if errors.As(err, &errPasswordResetIssue) {
			writeError(r, w, &ErrorReply{
				Code:    http.StatusBadRequest,
				Reason:  "fieldError",
				Details: errPasswordResetIssue,
			})
			return
		} else if errors.Is(err, users.ErrNotFound) {
			writeError(r, w, &ErrorReply{
				Code:    http.StatusBadRequest,
				Reason:  "tokenInvalid",
				Message: "url invalid",
			})
			return
		} else if errors.Is(err, users.ErrTokenUsed) {
			writeError(r, w, &ErrorReply{
				Code:    http.StatusBadRequest,
				Reason:  "tokenUsed",
				Message: "url already used",
			})
			return
		} else if errors.Is(err, users.ErrTokenExpired) {
			writeError(r, w, &ErrorReply{
				Code:    http.StatusBadRequest,
				Reason:  "tokenExpired",
				Message: "url expired",
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
	writeData(r, w, sessionReply{user})
}
