package admin

import (
	"bytes"
	"encoding/json"
	"errors"
	"github.com/dzfranklin/plantopo/backend/internal/admin/admintemplates"
	"github.com/go-playground/form"
	"html/template"
	"net/http"
)

type M map[string]any

var funcs = template.FuncMap{
	"marshal": func(v any) (string, error) {
		j, err := json.Marshal(v)
		return string(j), err
	},
	"marshalIndent": func(v any) (string, error) {
		j, err := json.MarshalIndent(v, "", "  ")
		return string(j), err
	},
}

func (app *adminApp) render(w http.ResponseWriter, r *http.Request, name string, data M) {
	if data == nil {
		data = M{}
	}

	user := getUser(r.Context())
	data["SignedInUser"] = user

	tmpl, err := template.New("base.tmpl").Funcs(funcs).ParseFS(admintemplates.FS, "base.tmpl", name)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	b := new(bytes.Buffer)

	err = tmpl.ExecuteTemplate(b, "base.tmpl", data)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	_, _ = w.Write(b.Bytes())
}

func (app *adminApp) renderIsolatedTemplate(w http.ResponseWriter, r *http.Request, name string, data M) {
	tmpl, err := template.ParseFS(admintemplates.FS, name)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	b := new(bytes.Buffer)

	err = tmpl.Execute(b, data)
	if err != nil {
		app.internalServerError(w, r, err)
		return
	}

	_, _ = w.Write(b.Bytes())
}

func (app *adminApp) decodePostForm(r *http.Request, dst any) error {
	err := r.ParseForm()
	if err != nil {
		return err
	}

	err = app.formDecoder.Decode(dst, r.PostForm)
	if err != nil {
		// `dst` must be a non-nil pointer. If not we have a bug.
		var invalidDecoderError *form.InvalidDecoderError
		if errors.As(err, &invalidDecoderError) {
			panic(err)
		}

		return err
	}

	return nil
}
