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
	png.Encode(&buf, cameron.Identicon([]byte(r.RequestURI), 540, 60))
	w.Header().Set("Content-Type", "image/png")
	buf.WriteTo(w)
}
