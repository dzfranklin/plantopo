package admin

import (
	"encoding/json"
	"net/http"
)

func (app *adminApp) fireJobGet(w http.ResponseWriter, r *http.Request) {
	app.render(w, r, "fire_job.tmpl", M{})
}

type genericArgs struct {
	Kind_ string `form:"Kind"`
	Args  string
}

func (g genericArgs) Kind() string {
	return g.Kind_
}

func (g genericArgs) MarshalJSON() ([]byte, error) {
	return json.Marshal(json.RawMessage(g.Args))
}

func (app *adminApp) fireJobPost(w http.ResponseWriter, r *http.Request) {
	var formData genericArgs
	if err := app.decodePostForm(r, &formData); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	row, err := app.Jobs.Insert(r.Context(), formData, nil)
	if err != nil {
		app.render(w, r, "fire_job.tmpl", M{"Status": err.Error()})
		return
	}

	rowJSON, err := json.Marshal(row)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	app.render(w, r, "fire_job.tmpl", M{"Status": string(rowJSON)})
}
