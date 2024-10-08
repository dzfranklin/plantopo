package papi

import (
	"github.com/dzfranklin/plantopo/backend/internal/pstaticmap"
	"net/http"
)

func (h *phandler) StaticMapGet(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "only GET is supported", http.StatusMethodNotAllowed)
		return
	}

	opts, parseOptsErr := pstaticmap.ParseOpts(r.URL.RawQuery)
	if parseOptsErr != nil {
		w.WriteHeader(http.StatusBadRequest)
		http.Error(w, "invalid query: "+parseOptsErr.Error(), http.StatusBadRequest)
		return
	}

	webp, drawErr := h.staticmap.DrawWebp(r.Context(), opts)
	if drawErr != nil {
		w.WriteHeader(http.StatusInternalServerError)
		http.Error(w, "failed to draw: "+drawErr.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "image/webp")
	w.Header().Set("Cache-Control", "max-age=31536000") // one year, the max

	_, _ = w.Write(webp)
}
