package repo

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/danielzfranklin/plantopo/auth"
	"github.com/danielzfranklin/plantopo/db"
	"github.com/danielzfranklin/plantopo/logger"
	"github.com/danielzfranklin/plantopo/mailer"
	"github.com/google/uuid"
	"github.com/jackc/pgerrcode"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

type IRepo interface {
	Get(ctx context.Context, userId uuid.UUID) (*auth.User, error)
	Register(req auth.RegistrationRequest) (*auth.User, error)
	Confirm(token string) (*auth.User, error)
	CheckLogin(ctx context.Context, req auth.LoginRequest) (*auth.User, error)
	IsAuthorized(ctx context.Context, req auth.AuthzRequest) bool
	MapAccess(ctx context.Context, mapId uuid.UUID) (*auth.MapAccess, error)
	Invite(ctx context.Context, req auth.InviteRequest) error
}

type ErrNotFound struct{}

func (e ErrNotFound) Error() string {
	return "not found"
}

type ErrTokenExpired struct{}

func (e ErrTokenExpired) Error() string {
	return "token expired"
}

type Repo struct {
	wg          *sync.WaitGroup
	pg          *db.Pg
	mailer      mailer.IMailer
	l           *zap.Logger
	ctx         context.Context
	tokenExpiry time.Duration
}

var hashCost = bcrypt.DefaultCost

func New(
	ctx context.Context, wg *sync.WaitGroup, pg *db.Pg, mailer mailer.IMailer,
) *Repo {
	l := logger.FromCtx(ctx).Named("auth/repo")
	r := &Repo{
		wg:          wg,
		pg:          pg,
		mailer:      mailer,
		l:           l,
		ctx:         ctx,
		tokenExpiry: 7 * 24 * time.Hour,
	}

	wg.Add(1)
	go r.doMailing()

	return r
}

func (r *Repo) Get(ctx context.Context, userId uuid.UUID) (*auth.User, error) {
	var user auth.User
	err := r.pg.QueryRow(ctx,
		"SELECT id, email, full_name, created_at, confirmed_at FROM users WHERE id = $1",
		userId,
	).Scan(&user.Id, &user.Email, &user.FullName, &user.CreatedAt, &user.ConfirmedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, &ErrNotFound{}
		} else {
			return nil, err
		}
	}
	return &user, nil
}

func (r *Repo) Register(req auth.RegistrationRequest) (*auth.User, error) {
	if err := req.Validate(); err != nil {
		r.l.Info("invalid registration request", zap.Error(err))
		return nil, err
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), hashCost)
	if err != nil {
		r.l.DPanic("failed to hash password", zap.Error(err))
		return nil, err
	}

	tx, err := r.pg.Begin(context.Background())
	if err != nil {
		r.l.DPanic("failed to begin transaction", zap.Error(err))
		return nil, err
	}
	defer tx.Rollback(context.Background())

	var user auth.User
	err = tx.QueryRow(context.Background(),
		`INSERT INTO users (email, full_name, hashed_password)
		VALUES ($1, $2, $3)
		RETURNING id, email, full_name, created_at`,
		req.Email, req.FullName, hashedPassword,
	).Scan(&user.Id, &user.Email, &user.FullName, &user.CreatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			if pgErr.ConstraintName == "users_email_key" && pgErr.Code == pgerrcode.UniqueViolation {
				r.l.Info("email is already taken")
				return nil, &auth.ErrRegistrationIssue{Email: "is already taken"}
			}
		}
		r.l.DPanic("failed to insert user", zap.Error(err))
		return nil, err
	}

	rows, err := tx.Query(context.Background(),
		`INSERT INTO unsent_confirmation_emails (user_id) VALUES ($1)`,
		user.Id,
	)
	if err != nil {
		r.l.DPanic("failed to insert unsent_confirmation_emails", zap.Error(err))
		return nil, err
	}
	rows.Close()

	rows, err = tx.Query(context.Background(), "NOTIFY unsent_confirmation_emails")
	if err != nil {
		r.l.DPanic("failed to notify unsent_confirmation_emails", zap.Error(err))
		return nil, err
	}
	rows.Close()

	err = tx.Commit(context.Background())
	if err != nil {
		r.l.DPanic("failed to commit transaction", zap.Error(err))
		return nil, err
	}

	return &user, nil
}

func (r *Repo) Confirm(token string) (uuid.UUID, error) {
	tx, err := r.pg.Begin(r.ctx)
	if err != nil {
		r.l.DPanic("failed to begin transaction", zap.Error(err))
		return uuid.Nil, err
	}
	defer tx.Rollback(r.ctx)

	var createdAt time.Time
	var userId uuid.UUID
	err = tx.QueryRow(r.ctx,
		`DELETE FROM email_confirmation_tokens
			WHERE token = $1
			RETURNING created_at, user_id`,
		token,
	).Scan(&createdAt, &userId)
	if err != nil {
		if err == pgx.ErrNoRows {
			return uuid.Nil, &ErrNotFound{}
		} else {
			r.l.DPanic("failed to delete", zap.Error(err))
			return uuid.Nil, err
		}
	}

	if time.Since(createdAt) > r.tokenExpiry {
		return uuid.Nil, &ErrTokenExpired{}
	}

	_, err = tx.Exec(r.ctx,
		`UPDATE users SET confirmed_at = NOW() WHERE id = $1`,
		userId,
	)
	if err != nil {
		r.l.DPanic("failed to update users", zap.Error(err))
		return uuid.Nil, err
	}

	return userId, nil
}

func (r *Repo) CheckLogin(ctx context.Context, req auth.LoginRequest) (*auth.User, error) {
	if err := req.Validate(); err != nil {
		r.l.Info("invalid login request", zap.Error(err))
		return nil, err
	}

	var user auth.User
	var expectedPassword []byte
	err := r.pg.QueryRow(ctx,
		`SELECT id, email, full_name, created_at, confirmed_at, hashed_password
			FROM users WHERE email = $1`,
		req.Email,
	).Scan(
		&user.Id, &user.Email, &user.FullName, &user.CreatedAt, &user.ConfirmedAt,
		&expectedPassword,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, &auth.ErrLoginIssue{Email: "not found"}
		} else {
			r.l.DPanic("failed to query users", zap.Error(err))
			return nil, err
		}
	}

	err = bcrypt.CompareHashAndPassword(expectedPassword, []byte(req.Password))
	if err != nil {
		return nil, &auth.ErrLoginIssue{Password: "is incorrect"}
	}

	return &user, nil
}

func (r *Repo) IsAuthorized(ctx context.Context, req auth.AuthzRequest) bool {
	role := r.getRole(ctx, req)
	if role == "" {
		return false
	}
	switch req.Action {
	case auth.ActionView:
		return role == auth.RoleOwner || role == auth.RoleEditor || role == auth.RoleViewer
	case auth.ActionEdit:
		return role == auth.RoleOwner || role == auth.RoleEditor
	case auth.ActionViewAccess:
		return role == auth.RoleOwner
	case auth.ActionShare:
		return role == auth.RoleOwner
	case auth.ActionDelete:
		return role == auth.RoleOwner
	default:
		r.l.Info("unknown action", zap.String("action", string(req.Action)))
		return false
	}
}

func (r *Repo) getRole(ctx context.Context, req auth.AuthzRequest) auth.Role {
	if req.MapId == uuid.Nil {
		r.l.Info("IsAuthorized called with null mapId")
		return ""
	}

	var row pgx.Row
	if req.UserId == uuid.Nil {
		row = r.pg.QueryRow(ctx,
			`SELECT my_role FROM map_roles WHERE map_id = $1 AND user_id IS NULL`,
			req.MapId,
		)
	} else {
		row = r.pg.QueryRow(ctx,
			`SELECT my_role FROM map_roles WHERE map_id = $1 AND user_id = $2`,
			req.MapId, req.UserId,
		)
	}
	var role auth.Role
	err := row.Scan(&role)
	if err != nil {
		if err == pgx.ErrNoRows {
			return ""
		} else {
			r.l.DPanic("failed to query map_roles", zap.Error(err))
			return ""
		}
	}
	return role
}

func (r *Repo) MapAccess(ctx context.Context, mapId uuid.UUID) (*auth.MapAccess, error) {
	access := &auth.MapAccess{
		MapId: mapId,
	}

	rows, err := r.pg.Query(ctx,
		`SELECT user_id, my_role FROM map_roles
			ORDER BY created_at ASC
			WHERE map_id = $1`,
		mapId,
	)
	if err != nil {
		r.l.DPanic("failed to query map_roles", zap.Error(err))
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var userId uuid.UUID
		var role auth.Role
		err := rows.Scan(&userId, &role)
		if err != nil {
			r.l.DPanic("failed to scan map_roles", zap.Error(err))
			return nil, err
		}

		if role == auth.RoleOwner {
			if access.Owner != uuid.Nil {
				r.l.DPanic("multiple owners unsupported")
			}
			access.Owner = userId
		} else {
			access.UserAccess = append(access.UserAccess, auth.UserAccessEntry{
				UserId: userId,
				Role:   role,
			})
		}
	}

	err = r.pg.QueryRow(ctx,
		`SELECT general_access_level, general_access_role FROM maps WHERE id = $1`,
		mapId,
	).Scan(&access.GeneralAccessLevel, &access.GeneralAccessRole)
	if err != nil {
		r.l.DPanic("failed to query maps", zap.Error(err))
		return nil, err
	}

	rows, err = r.pg.Query(ctx,
		`SELECT email, role FROM pending_invites
			WHERE map_id = $1
			ORDER BY created_at ASC`,
		mapId)
	if err != nil {
		r.l.DPanic("failed to query pending_invites", zap.Error(err))
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		invite := auth.PendingInvite{}
		rows.Scan(&invite.Email, &invite.Role)
		access.PendingInvites = append(access.PendingInvites, invite)
	}

	return access, nil
}

func (r *Repo) Invite(ctx context.Context, req auth.InviteRequest) error {
	if err := req.Validate(); err != nil {
		r.l.Info("invalid invite request", zap.Error(err))
		return err
	}

	var userId uuid.UUID
	err := r.pg.QueryRow(ctx,
		`SELECT id FROM users WHERE email = $1`, req.Email).Scan(&userId)
	if err != nil && err != pgx.ErrNoRows {
		r.l.DPanic("failed to query users", zap.Error(err))
		return err
	}

	if userId == uuid.Nil {
		if req.Notify {
			panic("TODO: mail invitation")
		}
		return nil
	} else {
		err := r.grant(ctx, req.MapId, userId, req.Role)
		if err != nil {
			return err
		}

		if req.Notify {
			panic("TODO: mail notification")
		}
		return nil
	}
}

func (r *Repo) grant(
	ctx context.Context, mapId uuid.UUID, userId uuid.UUID, role auth.Role,
) error {
	_, err := r.pg.Exec(ctx,
		`INSERT INTO map_roles (map_id, user_id, my_role) VALUES ($1, $2, $3)`,
		mapId, userId, role,
	)
	if err != nil {
		r.l.DPanic("failed to insert map_roles", zap.Error(err))
		return err
	}
	return nil
}

func (r *Repo) doMailing() {
	defer r.wg.Done()

	l := r.l.Named("repoMailer")
	defer l.Info("doMailing exiting")

	poolConn, err := r.pg.Acquire(r.ctx)
	if err != nil {
		if r.ctx.Err() != nil {
			return
		}
		l.Panic("failed to acquire connection", zap.Error(err))
	}
	conn := poolConn.Conn()
	defer poolConn.Release()

	_, err = conn.Exec(r.ctx, "LISTEN unsent_confirmation_emails")
	if err != nil {
		if r.ctx.Err() != nil {
			return
		}
		l.Panic("failed to listen", zap.Error(err))
	}
	defer conn.Exec(r.ctx, "UNLISTEN unsent_confirmation_emails")

	for r.ctx.Err() == nil {
		user := claimConfirmation(r.ctx, l, conn)
		if user == nil {
			l.Info("no unclaimed unsent_confirmation_emails")
		} else if user.ConfirmedAt.Valid {
			l.Info("already confirmed", zap.String("userId", user.Id.String()))
		} else {
			token := mintConfirmationToken(r.ctx, l, conn, user.Id)
			err := r.mailer.SendConfirmationEmail(*user, token)
			if err != nil {
				markConfirmationEmailFailed(context.Background(), l, conn, user.Id)
			} else {
				markConfirmationComplete(context.Background(), l, conn, user.Id)
			}
		}

		_, err = conn.WaitForNotification(r.ctx)
		if err != nil {
			if r.ctx.Err() != nil {
				return
			}
			l.Panic("failed to wait for notification", zap.Error(err))
		}
	}
}

// panics on error as caled by the doMailing goroutine
func claimConfirmation(
	ctx context.Context, l *zap.Logger, conn *pgx.Conn,
) *auth.User {
	l = l.Named("claimConfirmation")

	tx, err := conn.Begin(ctx)
	if err != nil {
		l.Panic("failed to begin transaction", zap.Error(err))
	}
	defer tx.Rollback(ctx)

	var user auth.User
	err = tx.QueryRow(
		ctx,
		`UPDATE unsent_confirmation_emails as uce
		SET claimed_at = NOW()
		FROM
			(
				SELECT user_id FROM unsent_confirmation_emails
				WHERE claimed_at IS NULL
				ORDER BY created_at ASC
				LIMIT 1
				FOR UPDATE SKIP LOCKED
			) sub
		JOIN users as u ON u.id = sub.user_id
		WHERE uce.user_id = sub.user_id
		RETURNING u.id, u.email, u.full_name, u.created_at, u.confirmed_at`,
	).Scan(&user.Id, &user.Email, &user.FullName, &user.CreatedAt, &user.ConfirmedAt)
	if err != nil {
		if err == pgx.ErrNoRows || ctx.Err() != nil {
			return nil
		} else {
			l.Panic("query failed", zap.Error(err))
		}
	}

	l.Info("claimed confirmation", zap.String("userId", user.Id.String()))
	return &user
}

// panics on error as caled by the doMailing goroutine
// replaces the existing token if present
func mintConfirmationToken(
	ctx context.Context, l *zap.Logger, conn *pgx.Conn, userId uuid.UUID,
) string {
	l.Info("minting confirmation token", zap.String("userId", userId.String()))
	var token string
	err := conn.QueryRow(
		ctx,
		`INSERT INTO email_confirmation_tokens (user_id) VALUES ($1)
			ON CONFLICT (user_id)
			DO UPDATE SET created_at = NOW(), token = gen_random_uuid()
			RETURNING token`,
		userId,
	).Scan(&token)
	if err != nil {
		l.Panic("query failed", zap.Error(err))
	}
	return token
}

// panics on error as called by the doMailing goroutine
func markConfirmationComplete(
	ctx context.Context, l *zap.Logger, conn *pgx.Conn, userId uuid.UUID,
) {
	l.Info("marking confirmation complete", zap.String("userId", userId.String()))
	_, err := conn.Exec(
		ctx,
		`DELETE FROM unsent_confirmation_emails WHERE user_id = $1`,
		userId,
	)
	if err != nil {
		l.Panic("delete failed", zap.Error(err))
	}
}

// panics on error as called by the doMailing goroutine
func markConfirmationEmailFailed(
	ctx context.Context, l *zap.Logger, conn *pgx.Conn, userId uuid.UUID,
) {
	l.Info("marking confirmation email failed", zap.String("userId", userId.String()))
	_, err := conn.Exec(
		ctx,
		`UPDATE unsent_confirmation_emails SET failed_at = NOW() WHERE user_id = $1`,
		userId,
	)
	if err != nil {
		l.Panic("update failed", zap.Error(err))
	}
}
