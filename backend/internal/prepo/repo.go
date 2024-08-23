package prepo

import "github.com/dzfranklin/plantopo/backend/internal/pconfig"

type Repo struct {
	AuditLog             *AuditLog
	Sessions             *Sessions
	Users                *Users
	AuthorizedSMSSenders *AuthorizedSMSSenders
	BritishAndIrishHills *BritishAndIrishHills
}

func New(env *pconfig.Env) (*Repo, error) {
	al := newAuditLog(env)

	users, err := newUsers(env, al)
	if err != nil {
		return nil, err
	}

	return &Repo{
		AuditLog:             al,
		Sessions:             newSessions(env, al, users),
		Users:                users,
		AuthorizedSMSSenders: newAuthorizedSMSSenders(env),
		BritishAndIrishHills: NewBritishAndIrishHills(env.DB),
	}, nil
}
