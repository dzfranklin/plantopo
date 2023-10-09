package routes

import (
	"net/http"
)

func (s *Services) healthzHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte("{}\n"))
}
