package penv

import (
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/pimg"
	"github.com/dzfranklin/plantopo/backend/internal/pjobs"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/dzfranklin/plantopo/backend/internal/psqlc"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/minio/minio-go/v7"
	miniocredentials "github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/redis/go-redis/v9"
	"log"
	"log/slog"
	"time"
)

const flagUpdateInterval = time.Second * 15

func Load() *pconfig.Env {
	_ = godotenv.Load(".env", ".env.local")
	cfg := pconfig.Read()

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
		Img:          pimg.New(cfg.Imgproxy.Key, cfg.Imgproxy.Salt),
		FlagProvider: StartFlagRepo(logger, db, flagUpdateInterval),
	}

	pjobs.Register(env, jobs, jobWorkers)

	return env
}

func openDB(cfg *pconfig.Config, logger *slog.Logger) *pgxpool.Pool {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	config, err := pgxpool.ParseConfig(cfg.Postgres.URL)
	if err != nil {
		log.Fatal(err)
	}

	config.ConnConfig.Tracer = prepo.NewTracer(logger)
	psqlc.ConfigurePool(config)

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
