package routes

import (
	_ "embed"
	"encoding/json"
	"net/http"
)

//go:embed mapSources.json
var data []byte

func (s *Services) mapSourcesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		writeMethodNotAllowed(w)
		return
	}
	writeData(w, json.RawMessage(data))
}
