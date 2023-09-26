package routes

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/danielzfranklin/plantopo/api/logger"
	"go.uber.org/zap"
)

type replyContainer struct {
	Data  interface{} `json:"data,omitempty"`
	Error *ErrorReply `json:"error,omitempty"`
}

type ErrorReply struct {
	// required
	Code int `json:"code"`
	// machine readable, optional
	Reason string `json:"reason,omitempty"`
	// human readable, optional
	Message string `json:"message,omitempty"`
	// machine readable, can contain human readable, optional
	Details interface{} `json:"details,omitempty"`
}

func (e *ErrorReply) Error() string {
	return e.Message
}

func writeData(w http.ResponseWriter, value interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	err := json.NewEncoder(w).Encode(replyContainer{Data: value})
	if err != nil {
		logger.Get().Panic("failed to marshal json", zap.Error(err))
	}
}

func writeError(w http.ResponseWriter, err error) {
	var errReply *ErrorReply
	if !errors.As(err, &errReply) {
		errReply = &ErrorReply{
			Code:    http.StatusInternalServerError,
			Message: "internal server error",
		}
	}
	logger.Get().Info("writing error response",
		zap.Int("code", errReply.Code),
		zap.String("reason", errReply.Reason),
		zap.Any("error", err),
	)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(errReply.Code)
	err = json.NewEncoder(w).Encode(replyContainer{Error: errReply})
	if err != nil {
		logger.Get().Panic("failed to marshal json", zap.Error(err))
	}
}

func writeMethodNotAllowed(w http.ResponseWriter) {
	writeError(w, &ErrorReply{
		Code:    http.StatusMethodNotAllowed,
		Message: "method not allowed",
	})
}

func writeBadRequest(w http.ResponseWriter) {
	writeError(w, &ErrorReply{
		Code:    http.StatusBadRequest,
		Message: "bad request",
	})
}

func writeUnauthorized(w http.ResponseWriter) {
	writeError(w, &ErrorReply{
		Code:    http.StatusUnauthorized,
		Message: "unauthorized",
	})
}

func writeForbidden(w http.ResponseWriter) {
	writeError(w, &ErrorReply{
		Code:    http.StatusForbidden,
		Message: "forbidden",
	})
}

func writeNotFound(w http.ResponseWriter) {
	writeError(w, &ErrorReply{
		Code:    http.StatusNotFound,
		Message: "not found",
	})
}

func writeInternalError(w http.ResponseWriter, err error) {
	logger.Get().Warn("writing internal server error", zap.Error(err))
	writeError(w, &ErrorReply{
		Code:    http.StatusInternalServerError,
		Message: "internal server error",
	})
}
