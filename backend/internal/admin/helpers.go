package admin

import (
	"bytes"
	"github.com/dzfranklin/plantopo/backend/internal/admin/admintemplates"
	"html/template"
	"net/http"
)

type M map[string]any

func (app *adminApp) render(w http.ResponseWriter, r *http.Request, name string, data M) {
	if data == nil {
		data = M{}
	}

	user := getUser(r.Context())
	data["SignedInUser"] = user

	tmpl, err := template.ParseFS(admintemplates.FS, "base.tmpl", name)
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

//func (app *adminApp) decodePostForm(r *http.Request, dst any) error {
//	err := r.ParseForm()
//	if err != nil {
//		return err
//	}
//
//	err = app.formDecoder.Decode(dst, r.PostForm)
//	if err != nil {
//		// `dst` must be a non-nil pointer. If not we have a bug.
//		var invalidDecoderError *form.InvalidDecoderError
//		if errors.As(err, &invalidDecoderError) {
//			panic(err)
//		}
//
//		return err
//	}
//
//	return nil
//}
