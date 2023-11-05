package users

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/danielzfranklin/plantopo/api_server/internal/logger"
	"github.com/danielzfranklin/plantopo/api_server/internal/mailer"
	"github.com/danielzfranklin/plantopo/api_server/internal/types"
	"github.com/danielzfranklin/plantopo/db"
	"github.com/google/uuid"
	"github.com/guregu/null"
	"github.com/jackc/pgerrcode"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

type Service interface {
	Get(ctx context.Context, userId uuid.UUID) (*types.User, error)
	GetByEmail(ctx context.Context, email string) (*types.User, error)
	GetEach(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID]types.User, error)
	Register(req RegisterRequest) (*types.User, error)
	RerequestConfirmation(email string) error
	Confirm(token string) (uuid.UUID, error)
	RequestPasswordReset(email string) error
	CheckPasswordReset(ctx context.Context, token string) (*types.User, error)
	ResetPassword(token string, newPassword string) (*types.User, error)
	CheckLogin(ctx context.Context, req LoginRequest) (*types.User, error)
}

var ErrNotFound = errors.New("not found")
var ErrTokenExpired = errors.New("token expired")
var ErrTokenUsed = errors.New("token used")

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

func (r *impl) Get(ctx context.Context, userId uuid.UUID) (*types.User, error) {
	user := types.User{Id: userId, ImageUrl: imageUrlFor(userId)}
	err := r.pg.QueryRow(ctx,
		`SELECT email, full_name, created_at, confirmed_at from users
			WHERE id = $1`,
		userId,
	).Scan(&user.Email, &user.FullName, &user.CreatedAt, &user.ConfirmedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		} else {
			return nil, err
		}
	}
	return &user, nil
}

func (r *impl) GetByEmail(ctx context.Context, email string) (*types.User, error) {
	user := types.User{Email: email}
	err := r.pg.QueryRow(ctx,
		`SELECT id, full_name, created_at, confirmed_at from users
			WHERE email = $1`,
		email,
	).Scan(&user.Id, &user.FullName, &user.CreatedAt, &user.ConfirmedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		} else {
			return nil, err
		}
	}
	user.ImageUrl = imageUrlFor(user.Id)
	return &user, nil
}

func (r *impl) GetEach(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID]types.User, error) {
	// TODO: Do this in O(1) queries.
	out := make(map[uuid.UUID]types.User)
	for _, id := range ids {
		user, err := r.Get(ctx, id)
		if err != nil {
			return nil, err
		}
		out[id] = *user
	}
	return out, nil
}

func (r *impl) Register(req RegisterRequest) (*types.User, error) {
	if err := req.Validate(); err != nil {
		r.l.Info("invalid registration request", zap.Error(err))
		return nil, err
	}

	ok, err := r.mailer.CheckDeliverable(r.ctx, req.Email)
	if err != nil {
		r.l.Info("failed to check deliverability", zap.Error(err))
		return nil, err
	}
	if !ok {
		r.l.Info("email is not deliverable", zap.String("email", req.Email))
		return nil, &ErrRegistrationIssue{Email: "could not be sent to"}
	}

	hashedPassword, err := createHashedPassword(req.Password)
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

	var user types.User
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
	user.ImageUrl = imageUrlFor(user.Id)

	token, err := r.createConfirmToken(tx, &user)
	if err != nil {
		return nil, err
	}

	err = tx.Commit(context.Background())
	if err != nil {
		r.l.DPanic("failed to commit transaction", zap.Error(err))
		return nil, err
	}

	err = r.mailer.SendConfirmation(&user, token)
	if err != nil {
		return nil, err
	}

	return &user, nil
}

func (r *impl) RerequestConfirmation(email string) error {
	user, err := r.GetByEmail(r.ctx, email)
	if err != nil {
		return err
	}

	tx, err := r.pg.Begin(context.Background())
	if err != nil {
		r.l.DPanic("failed to begin transaction", zap.Error(err))
		return err
	}
	defer tx.Rollback(context.Background())

	token, err := r.createConfirmToken(tx, user)
	if err != nil {
		return err
	}

	err = tx.Commit(context.Background())
	if err != nil {
		r.l.DPanic("failed to commit transaction", zap.Error(err))
		return err
	}

	err = r.mailer.SendConfirmation(user, token)
	if err != nil {
		return err
	}

	return nil
}

func (r *impl) createConfirmToken(tx pgx.Tx, user *types.User) (string, error) {
	var token string
	err := tx.QueryRow(
		context.Background(),
		`INSERT INTO email_confirmation_tokens (user_id) VALUES ($1)
			RETURNING token`,
		user.Id,
	).Scan(&token)
	if err != nil {
		r.l.DPanic("insert failed", zap.Error(err))
		return "", err
	}
	return token, nil
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
		`SELECT user_id, issued_at, used_at FROM email_confirmation_tokens
			WHERE token = $1`,
		token).Scan(&userId, &issuedAt, &usedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return uuid.Nil, ErrNotFound
		} else {
			r.l.DPanic("failed to query", zap.Error(err))
			return uuid.Nil, err
		}
	}

	if usedAt.Valid {
		return uuid.Nil, ErrTokenUsed
	}

	if time.Since(issuedAt) > r.tokenExpiry {
		return uuid.Nil, ErrTokenExpired
	}

	_, err = tx.Exec(r.ctx,
		`UPDATE users SET confirmed_at = NOW() WHERE id = $1`,
		userId,
	)
	if err != nil {
		r.l.DPanic("update failed", zap.Error(err))
		return uuid.Nil, err
	}

	tag, err := tx.Exec(r.ctx,
		`UPDATE email_confirmation_tokens SET used_at = NOW() WHERE token = $1`,
		token,
	)
	if err != nil {
		r.l.DPanic("update failed", zap.Error(err))
		return uuid.Nil, err
	}
	if tag.RowsAffected() != 1 {
		r.l.DPanic("expected to change 1 row", zap.Any("tag", tag))
	}

	err = tx.Commit(r.ctx)
	if err != nil {
		r.l.DPanic("failed to commit transaction", zap.Error(err))
		return uuid.Nil, err
	}

	return userId, nil
}

func (r *impl) forceConfirm(userId uuid.UUID) error {
	_, err := r.pg.Exec(r.ctx,
		`UPDATE users SET confirmed_at = NOW() WHERE id = $1`,
		userId,
	)
	if err != nil {
		r.l.DPanic("update failed", zap.Error(err))
		return err
	}
	return nil
}

func (r *impl) RequestPasswordReset(email string) error {
	user, err := r.GetByEmail(r.ctx, email)
	if err != nil {
		return err
	}

	var token string
	err = r.pg.QueryRow(r.ctx,
		`INSERT INTO password_reset_tokens (user_id) VALUES ($1)
			RETURNING token`,
		user.Id,
	).Scan(&token)
	if err != nil {
		r.l.DPanic("insert failed", zap.Error(err))
		return err
	}

	err = r.mailer.SendPasswordReset(user, token)
	if err != nil {
		return err
	}

	return nil
}

func (r *impl) CheckPasswordReset(ctx context.Context, token string) (*types.User, error) {
	userId, err := r.checkPasswordReset(token)
	if err != nil {
		return nil, err
	}
	return r.Get(r.ctx, userId)
}

func (r *impl) ResetPassword(token string, newPassword string) (*types.User, error) {
	userId, err := r.checkPasswordReset(token)
	if err != nil {
		return nil, err
	}

	if issue := validatePassword(newPassword); issue != "" {
		return nil, &ErrPasswordResetIssue{issue}
	}

	hashedPassword, err := createHashedPassword(newPassword)
	if err != nil {
		r.l.DPanic("failed to hash password", zap.Error(err))
		return nil, err
	}

	tx, err := r.pg.Begin(r.ctx)
	if err != nil {
		r.l.DPanic("failed to begin transaction", zap.Error(err))
		return nil, err
	}
	defer tx.Rollback(r.ctx)

	_, err = tx.Exec(r.ctx,
		`UPDATE users SET hashed_password = $1 WHERE id = $2`,
		hashedPassword, userId,
	)
	if err != nil {
		r.l.DPanic("update failed", zap.Error(err))
		return nil, err
	}

	_, err = tx.Exec(r.ctx,
		`UPDATE password_reset_tokens
			SET used_at = NOW()
			WHERE token = $1 AND used_at IS NULL`,
		token,
	)
	if err == pgx.ErrNoRows {
		// We already checked the token is valid, but we don't do so in the
		// same transaction. This means there was a concurrent reset.
		return nil, ErrTokenUsed
	} else if err != nil {
		r.l.DPanic("update failed", zap.Error(err))
		return nil, err
	}

	err = tx.Commit(r.ctx)
	if err != nil {
		r.l.DPanic("failed to commit transaction", zap.Error(err))
		return nil, err
	}

	return r.Get(r.ctx, userId)
}

func (r *impl) checkPasswordReset(token string) (uuid.UUID, error) {
	var userId uuid.UUID
	var issuedAt time.Time
	var usedAt null.Time
	err := r.pg.QueryRow(r.ctx,
		`SELECT user_id, issued_at, used_at FROM password_reset_tokens
			WHERE token = $1`,
		token).Scan(&userId, &issuedAt, &usedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return uuid.Nil, ErrNotFound
		} else {
			r.l.DPanic("failed to query", zap.Error(err))
			return uuid.Nil, err
		}
	}

	if usedAt.Valid {
		return uuid.Nil, ErrTokenUsed
	}

	if time.Since(issuedAt) > r.tokenExpiry {
		return uuid.Nil, ErrTokenExpired
	}

	return userId, nil
}

func (r *impl) CheckLogin(ctx context.Context, req LoginRequest) (*types.User, error) {
	if err := req.Validate(); err != nil {
		r.l.Info("invalid login request", zap.Error(err))
		return nil, err
	}

	var user types.User
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
	user.ImageUrl = imageUrlFor(user.Id)

	err = bcrypt.CompareHashAndPassword(expectedPassword, []byte(req.Password))
	if err != nil {
		return nil, &ErrLoginIssue{Password: "is incorrect"}
	}

	return &user, nil
}

func createHashedPassword(password string) ([]byte, error) {
	return bcrypt.GenerateFromPassword([]byte(password), hashCost)
}

func imageUrlFor(userId uuid.UUID) string {
	return fmt.Sprintf("https://api.plantopo.com/api/v1/account/profile-png/%s.png", userId)
}
