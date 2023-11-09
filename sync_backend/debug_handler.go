package main

import (
	"encoding/json"
	"github.com/danielzfranklin/plantopo/sync_backend/internal/backend"
	"net/http"
)

func debugHandler(b *backend.Backend) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			w.WriteHeader(http.StatusMethodNotAllowed)
			_, _ = w.Write([]byte("method not allowed"))
			return
		}

		var err error
		defer func() {
			if err != nil {
				w.WriteHeader(http.StatusInternalServerError)
				_, _ = w.Write([]byte(err.Error()))
			}
		}()

		switch r.URL.Path {
		case "/debug/stats":
			var value []byte
			value, err = json.Marshal(b.Stats())
			if err != nil {
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_, err = w.Write(value)
		case "/debug/sessions":
			var value []byte
			value, err = json.Marshal(b.Sessions())
			if err != nil {
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_, err = w.Write(value)
		default:
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte("not found"))
		}

	}
}
