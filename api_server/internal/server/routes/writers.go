package routes

import (
	"compress/gzip"
	"encoding/json"
	"errors"
	"github.com/danielzfranklin/plantopo/api_server/internal/rid"
	"net/http"

	"github.com/danielzfranklin/plantopo/api_server/internal/logger"
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

func writeData(r *http.Request, w http.ResponseWriter, value interface{}) {
	requestId := rid.FromCtx(r.Context())
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Request-Id", requestId.String())

	out, err := json.Marshal(replyContainer{Data: value})
	if err != nil {
		logger.Get().Panic("failed to marshal json", zap.Error(err))
	}

	if len(out) > 4096 {
		w.Header().Set("Content-Encoding", "gzip")
		w.WriteHeader(http.StatusOK)
		gw := gzip.NewWriter(w)
		defer gw.Close()
		_, _ = gw.Write(out)
	} else {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(out)
	}
}

func writeError(r *http.Request, w http.ResponseWriter, err error) {
	var errReply *ErrorReply
	if !errors.As(err, &errReply) {
		errReply = &ErrorReply{
			Code:    http.StatusInternalServerError,
			Message: "internal server error",
		}
	}
	requestId := rid.FromCtx(r.Context())
	logger.Get().Info("writing error response",
		zap.String("rid", requestId.String()),
		zap.Int("code", errReply.Code),
		zap.String("reason", errReply.Reason),
		zap.Any("error", err),
	)

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Request-Id", requestId.String())
	w.WriteHeader(errReply.Code)
	err = json.NewEncoder(w).Encode(replyContainer{Error: errReply})
	if err != nil {
		logger.Get().Panic("failed to marshal json", zap.Error(err))
	}
}

func writeMethodNotAllowed(r *http.Request, w http.ResponseWriter) {
	writeError(r, w, &ErrorReply{
		Code:    http.StatusMethodNotAllowed,
		Message: "method not allowed",
	})
}

func writeBadRequest(r *http.Request, w http.ResponseWriter) {
	writeError(r, w, &ErrorReply{
		Code:    http.StatusBadRequest,
		Message: "bad request",
	})
}

func writeUnauthorized(r *http.Request, w http.ResponseWriter) {
	writeError(r, w, &ErrorReply{
		Code:    http.StatusUnauthorized,
		Message: "unauthorized",
	})
}

func writeForbidden(r *http.Request, w http.ResponseWriter) {
	writeError(r, w, &ErrorReply{
		Code:    http.StatusForbidden,
		Message: "forbidden",
	})
}

func writeNotFound(r *http.Request, w http.ResponseWriter) {
	writeError(r, w, &ErrorReply{
		Code:    http.StatusNotFound,
		Message: "not found",
	})
}

func writeInternalError(r *http.Request, w http.ResponseWriter, err error) {
	requestId := rid.FromCtx(r.Context())
	logger.Get().Warn("writing internal server error", zap.Error(err), zap.String("rid", requestId.String()))
	writeError(r, w, &ErrorReply{
		Code:    http.StatusInternalServerError,
		Message: "internal server error",
	})
}
