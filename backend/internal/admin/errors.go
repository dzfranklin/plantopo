package admin

import "net/http"

func (app *adminApp) internalServerError(w http.ResponseWriter, r *http.Request, err error) {
	w.WriteHeader(http.StatusInternalServerError)
	_, _ = w.Write([]byte("Internal Server Error"))
	app.Logger.Error("internal server error", "error", err)
}

func (app *adminApp) clientError(w http.ResponseWriter, status int) {
	http.Error(w, http.StatusText(status), status)
}
