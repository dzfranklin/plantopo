package prepo

import (
	"errors"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/psqlc"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/throttled/throttled/v2"
	throttledredisstore "github.com/throttled/throttled/v2/store/goredisstore.v9"
	"golang.org/x/crypto/bcrypt"
	"log/slog"
)

var (
	userIDKind = "u"
)

type Users struct {
	cfg           *pconfig.Users
	l             *slog.Logger
	al            *AuditLog
	db            *pgxpool.Pool
	loginThrottle *throttled.GCRARateLimiterCtx
}

func newUsers(env *pconfig.Env, al *AuditLog) (*Users, error) {
	cfg := &env.Config.Users

	loginThrottle, err := makeLoginThrottle(env.RDB, cfg.LoginThrottle)
	if err != nil {
		return nil, err
	}

	return &Users{
		cfg:           cfg,
		l:             env.Logger,
		al:            al,
		db:            env.DB,
		loginThrottle: loginThrottle,
	}, nil
}

type User struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Email          string `json:"email"`
	EmailConfirmed bool   `json:"emailConfirmed"`
}

type UserRegistration struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (r *Users) Get(id string) (User, error) {
	ctx, cancel := defaultContext()
	defer cancel()

	dbID, err := IDToUUID(userIDKind, id)
	if err != nil {
		return User{}, err
	}

	row, err := q.SelectUser(ctx, r.db, pgUUID(dbID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return User{}, ErrNotFound
		}
		return User{}, err
	}
	return mapUser(row), nil
}

func (r *Users) GetByEmail(email string) (User, error) {
	user, _, err := r.getByEmailWithPasswordHash(email)
	return user, err
}

func (r *Users) getByEmailWithPasswordHash(email string) (User, []byte, error) {
	ctx, cancel := defaultContext()
	defer cancel()
	row, err := q.SelectUserByEmail(ctx, r.db, email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return User{}, nil, ErrNotFound
		}
		return User{}, nil, err
	}
	return mapUser(row), row.PasswordHash, nil
}

func (r *Users) Register(req UserRegistration) (User, error) {
	ctx, cancel := defaultContext()
	defer cancel()

	validator := Validator{}
	validator.CheckLength(req.Name, "name", 1, 500)
	validator.CheckEmail(req.Email, "email")
	validator.CheckPassword(req.Password, "password",
		r.cfg.MinPasswordStrength,
		[]string{req.Name, req.Email, "plantopo"})
	if err := validator.ToError(); err != nil {
		return User{}, err
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), r.cfg.PasswordHashCost)
	if err != nil {
		return User{}, err
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return User{}, err
	}
	defer tx.Rollback(ctx)

	userRow, err := q.InsertUser(ctx, tx,
		psqlc.InsertUserParams{
			Email:        req.Email,
			Name:         pgText(req.Name),
			PasswordHash: passwordHash,
		},
	)
	if err != nil {
		if isUniqueViolationErr(err, "users_email_uniq") {
			return User{}, validator.WithError("email", "is already registered").ToError()
		}
		return User{}, err
	}
	user := mapUser(userRow)

	// WatchStatus: Enqueue to send confirmation email via river

	err = tx.Commit(ctx)
	if err != nil {
		return User{}, err
	}

	r.al.Push(user.ID, user.ID, "Register", map[string]any{"email": user.Email})

	return user, nil
}

func (r *Users) CheckLogin(email string, password string) (User, error) {
	ctx, cancel := defaultContext()
	defer cancel()

	validator := Validator{}

	rateLimited, rateLimitResult, err := r.loginThrottle.RateLimitCtx(ctx, email, 1)
	if err != nil {
		return User{}, err
	}
	if rateLimited {
		r.l.Info("login rate limited", "email", email)
		return User{}, makeRateLimitedError(rateLimitResult)
	}

	user, passwordHash, err := r.getByEmailWithPasswordHash(email)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			r.l.Info("failed login: no user", "email", email)
			return User{}, validator.WithError("email", "is incorrect").ToError()
		}
		return User{}, err
	}

	if len(passwordHash) == 0 {
		return User{}, errors.New("does not support login")
	}

	err = bcrypt.CompareHashAndPassword(passwordHash, []byte(password))
	if err != nil {
		switch {
		case errors.Is(err, bcrypt.ErrMismatchedHashAndPassword):
			r.l.Info("failed login: wrong password", "email", email)
			return User{}, validator.WithError("password", "is incorrect").ToError()
		default:
			return User{}, err
		}
	}

	r.al.Push(user.ID, user.ID, "Login", M{"email": user.Email})

	return user, nil
}

func (r *Users) IsAdmin(userID string) (bool, error) {
	ctx, cancel := defaultContext()
	defer cancel()

	dbID, err := IDToUUID(userIDKind, userID)
	if err != nil {
		return false, err
	}

	return q.SelectIsAdmin(ctx, r.db, pgUUID(dbID))
}

func (r *Users) List(cursor string) ([]User, string, error) {
	ctx, cancel := defaultContext()
	defer cancel()

	var cursorVal uuid.UUID
	if cursor != "" {
		var err error
		cursorVal, err = IDToUUID("ucur", cursor)
		if err != nil {
			return nil, "", ErrInvalidCursor
		}
	}

	rows, err := q.ListUsers(ctx, r.db, cursorVal != uuid.Nil, pgUUID(cursorVal))
	if err != nil {
		return nil, "", err
	}

	var page []User
	for _, row := range rows {
		page = append(page, mapUser(row))
	}

	nextCursor := ""
	if len(page) > 0 {
		nextCursor = UUIDToID("ucur", rows[len(rows)-1].ID.Bytes)
	}

	return page, nextCursor, nil
}

func mapUser(user psqlc.User) User {
	return User{
		ID:             UUIDToID(userIDKind, user.ID.Bytes),
		Name:           user.Name.String,
		Email:          user.Email,
		EmailConfirmed: user.EmailConfirmed.Bool,
	}
}

func makeLoginThrottle(rdb *redis.Client, quota throttled.RateQuota) (*throttled.GCRARateLimiterCtx, error) {
	store, err := throttledredisstore.NewCtx(rdb, "account_throttle")
	if err != nil {
		return nil, err
	}
	throttle, err := throttled.NewGCRARateLimiterCtx(store, quota)
	if err != nil {
		return nil, err
	}
	return throttle, nil
}
