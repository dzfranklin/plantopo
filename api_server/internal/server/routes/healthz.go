package routes

import (
	"net/http"
)

func (s *Services) healthzHandler(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte("{}\n"))
}
