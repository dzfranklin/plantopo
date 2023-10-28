package routes

import (
	"net/http"
)

func (s *Services) mapTokensHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		writeMethodNotAllowed(r, w)
		return
	}
	writeData(w, s.FrontendMapTokens)
}
