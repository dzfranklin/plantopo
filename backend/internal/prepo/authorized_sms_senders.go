package prepo

import (
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/psqlc"
	"github.com/jackc/pgx/v5/pgxpool"
	"log/slog"
	"time"
)

const (
	authorizedSMSSenderIDKind = "asmss"
)

type AuthorizedSMSSenders struct {
	l  *slog.Logger
	db *pgxpool.Pool
}

func newAuthorizedSMSSenders(env *pconfig.Env) *AuthorizedSMSSenders {
	return &AuthorizedSMSSenders{
		l:  env.Logger,
		db: env.DB,
	}
}

type AuthorizedSMSSender struct {
	ID         string
	InsertedAt time.Time
	Number     string // In E.164 format
	Comment    string
}

func (r *AuthorizedSMSSenders) Check(number string) (bool, error) {
	ctx, cancel := defaultContext()
	defer cancel()
	return q.CheckAuthorizedSMSSender(ctx, r.db, number)
}

func (r *AuthorizedSMSSenders) Get(id string) (AuthorizedSMSSender, error) {
	ctx, cancel := defaultContext()
	defer cancel()

	dbID, err := IDToUUID(authorizedSMSSenderIDKind, id)
	if err != nil {
		return AuthorizedSMSSender{}, err
	}

	row, err := q.GetAuthorizedSMSSender(ctx, r.db, pgUUID(dbID))
	if err != nil {
		return AuthorizedSMSSender{}, err
	}

	return mapAuthorizedSMSSender(row), nil
}

func (r *AuthorizedSMSSenders) ListAll() ([]AuthorizedSMSSender, error) {
	ctx, cancel := defaultContext()
	defer cancel()

	rows, err := q.ListAllAuthorizedSMSSenders(ctx, r.db)
	if err != nil {
		return nil, err
	}

	var senders []AuthorizedSMSSender
	for _, row := range rows {
		senders = append(senders, mapAuthorizedSMSSender(row))
	}
	return senders, nil
}

func mapAuthorizedSMSSender(row psqlc.AuthorizedSmsSender) AuthorizedSMSSender {
	return AuthorizedSMSSender{
		ID:         UUIDToID(authorizedSMSSenderIDKind, row.ID.Bytes),
		InsertedAt: row.InsertedAt.Time,
		Number:     row.NumberE164,
		Comment:    row.Comment.String,
	}
}
