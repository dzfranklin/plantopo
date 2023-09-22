package routes

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/danielzfranklin/plantopo/api/logger"
	"github.com/danielzfranklin/plantopo/api/users"
)

func (s *Services) accountRegisterHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		writeMethodNotAllowed(w)
		return
	}
	var req users.RegisterRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		writeBadRequest(w)
		return
	}

	user, err := s.Users.Register(req)
	if err != nil {
		var errRegistrationIssue *users.ErrRegistrationIssue
		if errors.As(err, &errRegistrationIssue) {
			writeError(w, &ErrorReply{
				Code:    http.StatusBadRequest,
				Reason:  "badField",
				Details: errRegistrationIssue,
			})
			return
		} else {
			writeInternalError(w, err)
			return
		}
	}

	if err := s.SessionManager.Create(r, w, user.Id); err != nil {
		writeInternalError(w, err)
		return
	}
	logger.FromR(r).Sugar().Info("created session for newly registered user", "userId", user.Id)
	writeData(w, sessionReply{user})
}
