package routes

import (
	"encoding/json"
	"net/http"
)

func (s *Services) devHttpbinHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	err := json.NewEncoder(w).Encode(map[string]interface{}{
		"method": r.Method,
		"uri":    r.RequestURI,
		"url":    r.URL,
		"host":   r.Host,
		"remote": r.RemoteAddr,
		"proto":  r.Proto,
		"header": r.Header,
		"body":   r.Body,
	})
	if err != nil {
		panic(err)
	}
}
