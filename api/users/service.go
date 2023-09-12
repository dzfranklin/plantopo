package users

import (
	"context"
	"errors"
	"time"

	"github.com/danielzfranklin/plantopo/api/db"
	"github.com/danielzfranklin/plantopo/api/logger"
	"github.com/danielzfranklin/plantopo/api/mailer"
	"github.com/danielzfranklin/plantopo/api/user"
	"github.com/google/uuid"
	"github.com/guregu/null"
	"github.com/jackc/pgerrcode"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

type Service interface {
	Get(ctx context.Context, userId uuid.UUID) (*user.User, error)
	Register(req RegistraterRequest) (*user.User, error)
	Confirm(token string) (uuid.UUID, error)
	CheckLogin(ctx context.Context, req LoginRequest) (*user.User, error)
	IsAuthorized(ctx context.Context, req AuthzRequest) bool
	MapAccess(ctx context.Context, mapId uuid.UUID) (*MapAccess, error)
	Invite(ctx context.Context, req InviteRequest) error
}

type impl struct {
	pg          *db.Pg
	mailer      mailer.Service
	l           *zap.Logger
	ctx         context.Context
	tokenExpiry time.Duration
}

var hashCost = bcrypt.DefaultCost

func NewService(ctx context.Context, pg *db.Pg, mailer mailer.Service) Service {
	l := logger.FromCtx(ctx).Named("users")
	s := &impl{
		pg:          pg,
		mailer:      mailer,
		l:           l,
		ctx:         ctx,
		tokenExpiry: 7 * 24 * time.Hour,
	}
	return s
}

func (r *impl) Get(ctx context.Context, userId uuid.UUID) (*user.User, error) {
	var user user.User
	err := r.pg.QueryRow(ctx,
		"SELECT id, email, full_name, created_at, confirmed_at from users WHERE id = $1",
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

func (r *impl) Register(req RegistraterRequest) (*user.User, error) {
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

	var user user.User
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
				return nil, &ErrRegistrationIssue{Email: "is already taken"}
			}
		}
		r.l.DPanic("failed to insert user", zap.Error(err))
		return nil, err
	}

	var token string
	err = tx.QueryRow(
		context.Background(),
		`INSERT INTO email_confirmation_tokens (user_id) VALUES ($1)
			RETURNING token`,
		user.Id,
	).Scan(&token)
	if err != nil {
		r.l.DPanic("insert failed", zap.Error(err))
		return nil, err
	}

	err = tx.Commit(context.Background())
	if err != nil {
		r.l.DPanic("failed to commit transaction", zap.Error(err))
		return nil, err
	}

	err = r.mailer.SendConfirmation(user, token)
	if err != nil {
		r.l.DPanic("failed to send confirmation", zap.Error(err))
		return nil, err
	}

	return &user, nil
}

func (r *impl) Confirm(token string) (uuid.UUID, error) {
	tx, err := r.pg.Begin(r.ctx)
	if err != nil {
		r.l.DPanic("failed to begin transaction", zap.Error(err))
		return uuid.Nil, err
	}
	defer tx.Rollback(r.ctx)

	var userId uuid.UUID
	var issuedAt time.Time
	var usedAt null.Time
	err = tx.QueryRow(r.ctx,
		`SELECT user_id, created_at, used_at FROM email_confirmation_tokens
			WHERE token = $1`,
		token).Scan(&userId, &issuedAt, &usedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return uuid.Nil, &ErrNotFound{}
		} else {
			r.l.DPanic("failed to query", zap.Error(err))
			return uuid.Nil, err
		}
	}

	if usedAt.Valid {
		r.l.Info("confirmation with used token, allowing",
			zap.String("userId", userId.String()))
		return userId, nil
	}

	if time.Since(issuedAt) > r.tokenExpiry {
		return uuid.Nil, &ErrTokenExpired{}
	}

	_, err = tx.Exec(r.ctx,
		`UPDATE users SET confirmed_at = NOW() WHERE id = $1`,
		userId,
	)
	if err != nil {
		r.l.DPanic("update failed", zap.Error(err))
		return uuid.Nil, err
	}

	_, err = tx.Exec(r.ctx,
		`UPDATE email_confirmation_tokens SET used_at = NOW() WHERE token = $1`,
		token,
	)
	if err != nil {
		r.l.DPanic("update failed", zap.Error(err))
		return uuid.Nil, err
	}

	return userId, nil
}

func (r *impl) CheckLogin(ctx context.Context, req LoginRequest) (*user.User, error) {
	if err := req.Validate(); err != nil {
		r.l.Info("invalid login request", zap.Error(err))
		return nil, err
	}

	var user user.User
	var expectedPassword []byte
	err := r.pg.QueryRow(ctx,
		`SELECT id, email, full_name, created_at, confirmed_at, hashed_password
			from users WHERE email = $1`,
		req.Email,
	).Scan(
		&user.Id, &user.Email, &user.FullName, &user.CreatedAt, &user.ConfirmedAt,
		&expectedPassword,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, &ErrLoginIssue{Email: "not found"}
		} else {
			r.l.DPanic("failed to query users", zap.Error(err))
			return nil, err
		}
	}

	err = bcrypt.CompareHashAndPassword(expectedPassword, []byte(req.Password))
	if err != nil {
		return nil, &ErrLoginIssue{Password: "is incorrect"}
	}

	return &user, nil
}

func (r *impl) IsAuthorized(ctx context.Context, req AuthzRequest) bool {
	role := r.getRole(ctx, req)
	if role == "" {
		return false
	}
	switch req.Action {
	case ActionView:
		return role == RoleOwner || role == RoleEditor || role == RoleViewer
	case ActionEdit:
		return role == RoleOwner || role == RoleEditor
	case ActionViewAccess:
		return role == RoleOwner
	case ActionShare:
		return role == RoleOwner
	case ActionDelete:
		return role == RoleOwner
	default:
		r.l.Info("unknown action", zap.String("action", string(req.Action)))
		return false
	}
}

func (r *impl) getRole(ctx context.Context, req AuthzRequest) Role {
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
	var role Role
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

func (r *impl) MapAccess(ctx context.Context, mapId uuid.UUID) (*MapAccess, error) {
	access := &MapAccess{
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
		var role Role
		err := rows.Scan(&userId, &role)
		if err != nil {
			r.l.DPanic("failed to scan map_roles", zap.Error(err))
			return nil, err
		}

		if role == RoleOwner {
			if access.Owner != uuid.Nil {
				r.l.DPanic("multiple owners unsupported")
			}
			access.Owner = userId
		} else {
			access.UserAccess = append(access.UserAccess, UserAccessEntry{
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
		invite := PendingInvite{}
		rows.Scan(&invite.Email, &invite.Role)
		access.PendingInvites = append(access.PendingInvites, invite)
	}

	return access, nil
}

func (r *impl) Invite(ctx context.Context, req InviteRequest) error {
	if err := req.Validate(); err != nil {
		r.l.Info("invalid invite request", zap.Error(err))
		return err
	}

	var userId uuid.UUID
	err := r.pg.QueryRow(ctx,
		`SELECT id from users WHERE email = $1`, req.Email).Scan(&userId)
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

func (r *impl) grant(
	ctx context.Context, mapId uuid.UUID, userId uuid.UUID, role Role,
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
