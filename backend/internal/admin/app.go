package admin

import (
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/pemail"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/go-playground/form"
)

type adminApp struct {
	*pconfig.Env
	*prepo.Repo
	mailer      *pemail.Service
	formDecoder *form.Decoder
}
