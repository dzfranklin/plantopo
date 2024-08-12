package admin

import (
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/go-playground/form"
)

type adminApp struct {
	*pconfig.Env
	*prepo.Repo
	formDecoder *form.Decoder
}
