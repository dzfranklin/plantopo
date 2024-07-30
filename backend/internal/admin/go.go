package admin

import (
	"fmt"
	"net/http"
	"strings"
)

func (app *adminApp) goGet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	sep := strings.Index(id, "_")
	if sep == -1 {
		app.clientError(w, http.StatusNotFound)
		return
	}
	prefix := id[:sep]

	var seg string
	switch prefix {
	case "u":
		seg = "user"
	case "al":
		seg = "auditlog"
	case "asmss":
		seg = "authorized-sms-sender"
	default:

		app.clientError(w, http.StatusNotFound)
		return
	}

	dstPath := "/admin/" + seg + "/" + id
	w.Header().Add("Location", dstPath)
	w.WriteHeader(http.StatusTemporaryRedirect)
	_, _ = fmt.Fprintf(w, "Redirect to %s", dstPath)
}
