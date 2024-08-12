package admin

import (
	"encoding/json"
	"errors"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/dzfranklin/plantopo/backend/internal/pstrings"
	"net/http"
)

func (app *adminApp) auditlogGet(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	subjectFilter := q.Get("subject")
	objectFilter := q.Get("object")
	actionFilter := q.Get("action")
	queryCursor := q.Get("cursor")

	entries, cursor, err := app.AuditLog.ListBackwards(
		pstrings.EmptyToNil(subjectFilter),
		pstrings.EmptyToNil(objectFilter),
		pstrings.EmptyToNil(actionFilter),
		pstrings.EmptyToNil(queryCursor))
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	app.render(w, r, "auditlog.tmpl", M{
		"Subject": subjectFilter,
		"Object":  objectFilter,
		"Action":  actionFilter,
		"Cursor":  cursor,
		"Entries": entries,
	})
}

func (app *adminApp) auditlogEntryGet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	entry, err := app.AuditLog.Get(id)
	if err != nil {
		if errors.Is(err, prepo.ErrNotFound) || errors.Is(err, prepo.ErrInvalidID) {
			app.clientError(w, http.StatusNotFound)
			return
		}
		app.internalServerError(w, r, err)
		return
	}

	payloadJSON, err := json.MarshalIndent(entry.Payload, "", "    ")
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	app.render(w, r, "auditlog_entry.tmpl", M{
		"Entry":       entry,
		"PayloadJSON": string(payloadJSON),
	})
}
