package pconfig

import (
	"github.com/dzfranklin/plantopo/backend/internal/pimg"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/minio/minio-go/v7"
	"github.com/redis/go-redis/v9"
	"github.com/riverqueue/river"
	"github.com/throttled/throttled/v2"
	"log/slog"
	"time"
)

type Env struct {
	IsProduction bool
	Config       *Config
	Logger       *slog.Logger
	DB           *pgxpool.Pool
	RDB          *redis.Client
	Objects      *minio.Client
	Jobs         *river.Client[pgx.Tx]
	Img          *pimg.Config
	FlagProvider
}

type FlagProvider interface {
	BoolFlag(key string) bool
	SetBoolFlag(key string, value bool) error
	DeleteBoolFlag(key string) error
	ListBoolFlags() map[string]bool
}

type Config struct {
	Env            string
	Server         Server
	Elevation      Elevation
	Users          Users
	Session        Session
	Postgres       Postgres
	Redis          Redis
	S3             S3
	OrdnanceSurvey OrdnanceSurvey
	MetOffice      MetOffice
	DFTBusOpenData DFTBusOpenData
	Twilio         Twilio
	Imgproxy       Imgproxy
	SMTPRelay      SMTPRelay
	Mapbox         Mapbox
	Flickr         Flickr
	Geograph       Geograph
	DemoUser       DemoUser
}

type Elevation struct {
	DEMDataset string
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
	Domain         string
	CORSAllowHosts []string
}

type S3 struct {
	Endpoint  string
	AccessKey string
	SecretKey string
}

type OrdnanceSurvey struct {
	APIKey string
}

type MetOffice struct {
	DataPointAPIKey string
}

type DFTBusOpenData struct {
	Username string
	Password string
}

type Twilio struct {
	AccountSID string
	AuthToken  string
}

type Imgproxy struct {
	Key  string
	Salt string
}

type SMTPRelay struct {
	Server   string
	Port     int
	Username string
	Password string
}

type Mapbox struct {
	PrivateToken string
	PublicToken  string
}

type Flickr struct {
	APIKey string
}

type Geograph struct {
	ImageSecret string
}

type DemoUser struct {
	SampleTracksURL string
}
