package routes

import (
	"bytes"
	"image/png"
	"net/http"

	"github.com/aofei/cameron"
	"github.com/gorilla/mux"
)

func (s *Services) accountImageHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		writeMethodNotAllowed(r, w)
		return
	}
	id := mux.Vars(r)["id"]
	if id == "" {
		writeBadRequest(r, w)
		return
	}

	buf := bytes.Buffer{}
	err := png.Encode(&buf, cameron.Identicon([]byte(r.RequestURI), 540, 60))
	if err != nil {
		writeError(r, w, err)
		return
	}
	w.Header().Set("Content-Type", "image/png")
	_, _ = buf.WriteTo(w)
}
