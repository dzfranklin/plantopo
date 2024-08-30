package penv

import (
	"context"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/pjobs"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/minio/minio-go/v7"
	miniocredentials "github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/redis/go-redis/v9"
	"github.com/throttled/throttled/v2"
	"log"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"time"
)

const (
	minPasswordStrength = 1 // Since we throttle tries
)

func Load() (*pconfig.Env, *prepo.Repo) {
	_ = godotenv.Load(".env", ".env.local")

	cfg := &pconfig.Config{
		Env: getEnvString("APP_ENV"),
		Server: pconfig.Server{
			Port:           getEnvInt("PORT"),
			MetaPort:       getEnvInt("META_PORT"),
			CORSAllowHosts: getEnvStrings("CORS_ALLOW_HOSTS"),
		},
		Elevation: pconfig.Elevation{
			Endpoint: getEnvString("ELEVATION_API_ENDPOINT"),
		},
		Postgres: pconfig.Postgres{
			URL: getEnvString("DATABASE_URL"),
		},
		Redis: pconfig.Redis{
			Addr:     getEnvString("REDIS_ADDR"),
			Password: os.Getenv("REDIS_PASSWORD"),
			DB:       getOptionalEnvInt("REDIS_DB", 0),
		},
		S3: pconfig.S3{
			Endpoint:  getEnvString("S3_ENDPOINT"),
			AccessKey: getEnvString("S3_ACCESS_KEY"),
			SecretKey: getEnvString("S3_SECRET_KEY"),
		},
		Session: pconfig.Session{
			SessionIdleExpiry: 24 * time.Hour * 30, // WatchStatus: implement
		},
		Users: pconfig.Users{
			LoginThrottle:       throttled.RateQuota{MaxRate: throttled.PerMin(10), MaxBurst: 20},
			MinPasswordStrength: getOptionalEnvInt("MIN_PASSWORD_STRENGTH", minPasswordStrength),
			PasswordHashCost:    12,
		},
		OrdnanceSurvey: pconfig.OrdnanceSurvey{
			APIKey: getEnvString("OS_API_KEY"),
		},
		MetOffice: pconfig.MetOffice{
			DataPointAPIKey: getEnvString("MET_OFFICE_DATAPOINT_API_KEY"),
		},
		DFTBusOpenData: pconfig.DFTBusOpenData{
			Username: getEnvString("DFT_BUS_OPEN_DATA_USERNAME"),
			Password: getEnvString("DFT_BUS_OPEN_DATA_PASSWORD"),
		},
		Twilio: pconfig.Twilio{
			AccountSID: getEnvString("TWILIO_ACCOUNT_SID"),
			AuthToken:  getEnvString("TWILIO_AUTH_TOKEN"),
		},
		Imgproxy: pconfig.Imgproxy{
			Key:  getEnvString("IMGPROXY_KEY"),
			Salt: getEnvString("IMGPROXY_SALT"),
		},
		SMTPRelay: pconfig.SMTPRelay{
			Server:   getEnvString("SMTP_RELAY_SERVER"),
			Port:     getEnvInt("SMTP_RELAY_PORT"),
			Username: getEnvString("SMTP_RELAY_USERNAME"),
			Password: getEnvString("SMTP_RELAY_PASSWORD"),
		},
	}

	logger := pconfig.CreateLoggerForEnv(cfg.Env)
	slog.SetDefault(logger)

	db := openDB(cfg, logger)
	jobs, jobWorkers := pjobs.Open(db, logger)
	env := &pconfig.Env{
		IsProduction: cfg.Env == "production",
		Config:       cfg,
		Logger:       logger,
		DB:           db,
		RDB:          openRDB(cfg),
		Objects:      openObjects(cfg),
		Jobs:         jobs,
	}

	repo, err := prepo.New(env)
	if err != nil {
		log.Fatal(err)
	}

	pjobs.Register(env, repo, jobs, jobWorkers)

	return env, repo
}

func openDB(cfg *pconfig.Config, logger *slog.Logger) *pgxpool.Pool {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	config, err := pgxpool.ParseConfig(cfg.Postgres.URL)
	if err != nil {
		log.Fatal(err)
	}

	config.ConnConfig.Tracer = prepo.NewTracer(logger)

	db, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		log.Fatal(err)
	}

	go func() {
		_ = db.Ping(context.Background()) // warm up
	}()

	return db
}

func openRDB(cfg *pconfig.Config) *redis.Client {
	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.Redis.Addr,
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
	})

	go func() {
		_ = rdb.Ping(context.Background()) // warm up
	}()

	return rdb
}

func openObjects(cfg *pconfig.Config) *minio.Client {
	objects, err := minio.New(cfg.S3.Endpoint, &minio.Options{
		Secure: cfg.Env == "production",
		Creds:  miniocredentials.NewStaticV4(cfg.S3.AccessKey, cfg.S3.SecretKey, ""),
	})
	if err != nil {
		log.Fatal(err)
	}
	return objects
}

func getEnvInt(key string) int {
	v := os.Getenv(key)
	if v == "" {
		panic(fmt.Sprintf("Missing environment variable %s", key))
	}
	parsed, err := strconv.ParseInt(v, 10, 32)
	if err != nil {
		panic(fmt.Sprintf("Invalid environment variable %s. Expected an integer, got %s", key, v))
	}
	return int(parsed)
}

func getOptionalEnvInt(key string, defaultValue int) int {
	v := os.Getenv(key)
	if v == "" {
		return defaultValue
	}
	parsed, err := strconv.ParseInt(v, 10, 32)
	if err != nil {
		panic(fmt.Sprintf("Invalid environment variable %s. Expected an integer, got %s", key, v))
	}
	return int(parsed)
}

func getEnvString(key string) string {
	v := os.Getenv(key)
	if v == "" {
		panic(fmt.Sprintf("Missing environment variable %s", key))
	}
	return v
}

func getEnvStrings(key string) []string {
	v := os.Getenv(key)
	if v == "" {
		panic(fmt.Sprintf("Missing environment variable %s", key))
	}
	var parsed []string
	for _, part := range strings.Split(v, ",") {
		parsed = append(parsed, strings.TrimSpace(part))
	}
	return parsed
}
