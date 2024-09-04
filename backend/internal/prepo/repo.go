package prepo

import (
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
)

type Repo struct {
	AuditLog             *AuditLog
	Sessions             *Sessions
	Users                *Users
	AuthorizedSMSSenders *AuthorizedSMSSenders
	BritishAndIrishHills *BritishAndIrishHills
	Geophotos            *Geophotos
}

func New(env *pconfig.Env) *Repo {
	al := newAuditLog(env)
	users := newUsers(env, al)

	return &Repo{
		AuditLog:             al,
		Sessions:             newSessions(env, al, users),
		Users:                users,
		AuthorizedSMSSenders: newAuthorizedSMSSenders(env),
		BritishAndIrishHills: NewBritishAndIrishHills(env.DB),
		Geophotos:            newGeophotos(env.DB),
	}
}
