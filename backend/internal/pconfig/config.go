package pconfig

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/minio/minio-go/v7"
	"github.com/redis/go-redis/v9"
	"github.com/throttled/throttled/v2"
	"log/slog"
	"time"
)

type Env struct {
	Config  *Config
	Logger  *slog.Logger
	DB      *pgxpool.Pool
	RDB     *redis.Client
	Objects *minio.Client
}

type Config struct {
	Env       string
	Server    Server
	Elevation Elevation
	UserAgent string
	Users     Users
	Session   Session
	Postgres  Postgres
	Redis     Redis
	S3        S3
}

type Elevation struct {
	Endpoint string
}

type Postgres struct {
	URL string
}

type Redis struct {
	Addr     string
	Password string
	DB       int
}

type Users struct {
	LoginThrottle       throttled.RateQuota
	MinPasswordStrength int
	PasswordHashCost    int
}

type Session struct {
	SessionIdleExpiry time.Duration
}

type Server struct {
	Port           int
	MetaPort       int
	CORSAllowHosts []string
}

type S3 struct {
	Endpoint  string
	AccessKey string
	SecretKey string
}
