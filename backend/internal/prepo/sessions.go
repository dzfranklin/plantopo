package prepo

import (
	"errors"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/psqlc"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"log/slog"
	"net/netip"
	"time"
)

// TODO: Clean up expired sessions

type Sessions struct {
	cfg   *pconfig.Session
	l     *slog.Logger
	al    *AuditLog
	db    *pgxpool.Pool
	users *Users
}

func newSessions(env *pconfig.Env, al *AuditLog, users *Users) *Sessions {
	return &Sessions{
		l:     env.Logger,
		al:    al,
		cfg:   &env.Config.Session,
		db:    env.DB,
		users: users,
	}
}

type SessionInfo struct {
	UserID      string
	CreatedAt   time.Time
	ExpiryStart time.Time
	UserAgent   string
	IPAddr      *netip.Addr
}

type SessionCreateOptions struct {
	UserID    string
	UserAgent string
}

func (s *Sessions) Create(opts SessionCreateOptions) (string, error) {
	ctx, cancel := defaultContext()
	defer cancel()

	dbUserID, err := IDToUUID(userIDKind, opts.UserID)
	if err != nil {
		return "", err
	}

	_, err = s.users.Get(opts.UserID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return "", errors.New("user does not exist")
		}
		return "", err
	}

	token, err := q.InsertSession(ctx, s.db, psqlc.InsertSessionParams{
		UserID:    pgUUID(dbUserID),
		UserAgent: pgTextUnlessEmpty(opts.UserAgent),
	})
	if err != nil {
		return "", err
	}

	s.al.Push(opts.UserID, opts.UserID, "SessionCreate", M{
		"UserAgent": opts.UserAgent,
	})

	return token, nil
}

func (s *Sessions) Revoke(token string) error {
	ctx, cancel := defaultContext()
	defer cancel()

	dbUserID, err := q.DeleteSession(ctx, s.db, token)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			s.l.Info("revoked token that does not exist")
			return nil
		}
		return err
	}
	userID := UUIDToID(userIDKind, dbUserID.Bytes)

	s.al.Push(userID, userID, "SessionRevoke", nil)

	return nil
}

func (s *Sessions) LookupUser(token string) (string, error) {
	ctx, cancel := defaultContext()
	defer cancel()

	sess, err := q.GetSession(ctx, s.db, token)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrInvalidSessionToken
		}
		return "", err
	}

	if time.Since(sess.ExpiryStart.Time) > s.cfg.SessionIdleExpiry {
		return "", ErrInvalidSessionToken
	}

	if time.Since(sess.ExpiryStart.Time) > 24*time.Hour {
		err = q.RefreshSessionExpiry(ctx, s.db, token)
		if err != nil {
			return "", err
		}
	}

	return UUIDToID(userIDKind, sess.UserID.Bytes), nil
}

func (s *Sessions) ListSessionsByUser(userID string) ([]SessionInfo, error) {
	ctx, cancel := defaultContext()
	defer cancel()

	dbUserID, err := IDToUUID(userIDKind, userID)
	if err != nil {
		return nil, err
	}

	rows, err := q.ListSessionsByUser(ctx, s.db, pgUUID(dbUserID))
	if err != nil {
		return nil, err
	}

	var out []SessionInfo
	for _, row := range rows {
		out = append(out, SessionInfo{
			UserID:      UUIDToID(userIDKind, row.UserID.Bytes),
			CreatedAt:   row.CreatedAt.Time,
			ExpiryStart: row.ExpiryStart.Time,
			UserAgent:   row.UserAgent.String,
			IPAddr:      row.IpAddr,
		})
	}
	return out, nil
}
