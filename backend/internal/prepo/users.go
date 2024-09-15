package prepo

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/pemail"
	"github.com/dzfranklin/plantopo/backend/internal/prand"
	"github.com/dzfranklin/plantopo/backend/internal/psqlc"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/throttled/throttled/v2"
	throttledredisstore "github.com/throttled/throttled/v2/store/goredisstore.v9"
	"golang.org/x/crypto/bcrypt"
	"log/slog"
	"time"
)

type Users struct {
	cfg           *pconfig.Users
	l             *slog.Logger
	al            *AuditLog
	db            *pgxpool.Pool
	rdb           *redis.Client
	email         *pemail.Service
	loginThrottle *throttled.GCRARateLimiterCtx
}

func newUsers(env *pconfig.Env, al *AuditLog) *Users {
	cfg := &env.Config.Users

	loginThrottle := makeLoginThrottle(env.RDB, cfg.LoginThrottle)

	return &Users{
		cfg:           cfg,
		l:             env.Logger,
		al:            al,
		db:            env.DB,
		rdb:           env.RDB,
		email:         pemail.NewService(env),
		loginThrottle: loginThrottle,
	}
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
	return r.get(ctx, r.db, id)
}

func (r *Users) get(ctx context.Context, db psqlc.DBTX, id string) (User, error) {
	dbID, err := IDToUUID(userIDKind, id)
	if err != nil {
		return User{}, err
	}

	row, err := q.SelectUser(ctx, db, pgUUID(dbID))
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

	err = tx.Commit(ctx)
	if err != nil {
		return User{}, err
	}

	r.al.Push(user.ID, user.ID, "Register", map[string]any{"email": user.Email})

	verificationLink, err := r.createEmailVerificationLink(ctx, user)
	if err != nil {
		return User{}, err
	}
	if err := r.email.Send(pemail.CompleteRegistrationEmail(user.Email, verificationLink)); err != nil {
		return User{}, err
	}

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

type VerificationStatus string

const (
	VerificationSuccess          VerificationStatus = "verified"
	VerificationTokenExpired     VerificationStatus = "token-expired"
	VerificationTokenAlreadyUsed VerificationStatus = "token-already-used"
	VerificationTokenInvalid     VerificationStatus = "token-invalid"
)

type verificationRecord struct {
	User   string
	Email  string
	Expiry time.Time
	UsedAt time.Time
}

func (r verificationRecord) MarshalBinary() ([]byte, error) {
	return json.Marshal(r)
}
func (r *verificationRecord) UnmarshalBinary(data []byte) error {
	return json.Unmarshal(data, r)
}

const (
	verificationTokenExpiry    = time.Hour * 24 * 7
	verificationRecordDeletion = verificationTokenExpiry * 4
)

func (r *Users) VerifyEmail(token string) (VerificationStatus, error) {
	ctx, cancel := defaultContext()
	defer cancel()

	var record verificationRecord
	getErr := r.rdb.Get(ctx, emailVerificationTokenKey(token)).Scan(&record)
	if errors.Is(getErr, redis.Nil) {
		return VerificationTokenInvalid, nil
	} else if getErr != nil {
		return "", getErr
	}

	if !record.UsedAt.IsZero() {
		return VerificationTokenAlreadyUsed, nil
	}
	if record.Expiry.Before(time.Now()) {
		return VerificationTokenExpired, nil
	}

	tx, beginErr := r.db.Begin(ctx)
	if beginErr != nil {
		return "", beginErr
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	user, getUserErr := r.get(ctx, tx, record.User)
	if getUserErr != nil {
		return "", getUserErr
	}

	if user.Email != record.Email {
		// If the user has changed their email since we generated the token we silently do nothing.
		return VerificationSuccess, nil
	}

	dbID, idErr := IDToUUID(userIDKind, user.ID)
	if idErr != nil {
		return "", idErr
	}

	if err := q.MarkUserEmailConfirmed(ctx, tx, pgUUID(dbID)); err != nil {
		return "", err
	}

	if err := tx.Commit(ctx); err != nil {
		return "", err
	}

	return VerificationSuccess, nil
}

func (r *Users) createEmailVerificationLink(ctx context.Context, user User) (string, error) {
	token := prand.CryptoRandHex(32)
	key := emailVerificationTokenKey(token)
	record := verificationRecord{
		User:   user.ID,
		Email:  user.Email,
		Expiry: time.Now().Add(verificationTokenExpiry),
	}
	if err := r.rdb.Set(ctx, key, record, verificationRecordDeletion).Err(); err != nil {
		return "", err
	}
	link := "https://api.plantopo.com/api/v1/complete-registration?token=" + token
	return link, nil
}

func emailVerificationTokenKey(token string) string {
	return "email-verification-token:" + token
}

func mapUser(user psqlc.User) User {
	return User{
		ID:             UUIDToID(userIDKind, user.ID.Bytes),
		Name:           user.Name.String,
		Email:          user.Email,
		EmailConfirmed: user.EmailConfirmed.Bool,
	}
}

func makeLoginThrottle(rdb *redis.Client, quota throttled.RateQuota) *throttled.GCRARateLimiterCtx {
	store, err := throttledredisstore.NewCtx(rdb, "account_throttle")
	if err != nil {
		panic(err)
	}
	throttle, err := throttled.NewGCRARateLimiterCtx(store, quota)
	if err != nil {
		panic(err)
	}
	return throttle
}
