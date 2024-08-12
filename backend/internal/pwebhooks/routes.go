package pwebhooks

import (
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"net/http"
)

type phandler struct {
	*pconfig.Env
}

func Routes(env *pconfig.Env) http.Handler {
	h := &phandler{env}
	mux := http.NewServeMux()
	mux.HandleFunc("/webhooks/twilio/{webhook}", h.twilioHandler)
	return mux
}
