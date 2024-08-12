package main

import (
	"context"
	"errors"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/minio/minio-go/v7"
	miniocredentials "github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/redis/go-redis/v9"
	"github.com/throttled/throttled/v2"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"
)

const (
	minPasswordStrength = 1 // Since we throttle tries
)

func main() {
	_ = godotenv.Load(".env", ".env.local")

	cfg := &pconfig.Config{
		Env: getEnvString("APP_ENV"),
		Server: pconfig.Server{
			Port:           getEnvInt("PORT"),
			MetaPort:       getEnvInt("META_PORT"),
			CORSAllowHosts: getEnvStrings("CORS_ALLOW_HOSTS"),
		},
		UserAgent: "github.com/dzfranklin/plantopo (daniel@danielzfranklin.org)",
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
			SessionIdleExpiry: 24 * time.Hour * 30, // TODO: implement
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
		Twilio: pconfig.Twilio{
			AuthToken: getEnvString("TWILIO_AUTH_TOKEN"),
		},
		OpenTransitPlanner: pconfig.OpenTransitPlanner{
			GTFSEndpoint: getEnvString("OPEN_TRANSIT_PLANNER_GTFS_ENDPOINT"),
		},
	}

	logger := pconfig.CreateLoggerForEnv(cfg.Env)
	db := openDB(cfg, logger)
	jobs, jobWorkers := openRiver(db)
	env := &pconfig.Env{
		IsProduction: cfg.Env == "production",
		Config:       cfg,
		Logger:       logger,
		DB:           db,
		RDB:          openRDB(cfg),
		Objects:      openObjects(cfg),
		Jobs:         jobs,
	}

	l := env.Logger

	repo, err := prepo.New(env)
	if err != nil {
		log.Fatal(err)
	}

	setupRiver(env, repo, jobs, jobWorkers)

	shouldQuit := make(chan struct{})
	var quitGroup sync.WaitGroup

	l.Info("river starting")
	err = env.Jobs.Start(context.Background())
	if err != nil {
		log.Fatal(err)
	}
	quitGroup.Add(1)
	go func() {
		defer quitGroup.Done()
		<-shouldQuit

		softStopCtx, softStopCtxCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer softStopCtxCancel()

		err := env.Jobs.Stop(softStopCtx)
		if err != nil && !errors.Is(err, context.DeadlineExceeded) && !errors.Is(err, context.Canceled) {
			log.Fatal(err)
		}
		if err == nil {
			l.Info("soft stopped river")
			return
		}

		hardStopCtx, hardStopCtxCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer hardStopCtxCancel()

		// As long as all jobs respect context cancellation, StopAndCancel will
		// always work. However, in the case of a bug where a job blocks despite
		// being cancelled, it may be necessary to either ignore River's stop
		// result (what's shown here) or have a supervisor kill the process.
		err = env.Jobs.StopAndCancel(hardStopCtx)
		if err != nil && errors.Is(err, context.DeadlineExceeded) {
			fmt.Printf("Hard stop timeout; ignoring stop procedure and exiting unsafely\n")
		} else if err != nil {
			log.Fatal(err)
		}

		// hard stop succeeded
	}()

	quitGroup.Add(2)
	go func() {
		defer quitGroup.Done()
		srv := NewServer(env, repo)

		go func() {
			defer quitGroup.Done()
			<-shouldQuit

			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()

			l.Info("shutting down server")
			err := srv.Shutdown(ctx)
			if err != nil {
				l.Error("server shutdown failed", "error", err)
			}
			l.Info("shut down server")
		}()

		l.Info("server starting", "addr", srv.Addr)
		err := srv.ListenAndServe()
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			l.Error("server failed", "error", err)
		}
	}()

	quitGroup.Add(2)
	go func() {
		defer quitGroup.Done()
		srv := NewMetaServer(env)

		go func() {
			defer quitGroup.Done()
			<-shouldQuit

			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()

			l.Info("shutting down meta server")
			err := srv.Shutdown(ctx)
			if err != nil {
				l.Error("meta server shutdown failed", "error", err)
			}
			l.Info("shut down meta server")
		}()

		l.Info("meta server starting", "addr", srv.Addr)
		err := srv.ListenAndServe()
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			l.Error("meta server failed", "error", err)
		}
	}()

	quitRequestSignal := make(chan os.Signal, 1)
	signal.Notify(quitRequestSignal, syscall.SIGINT, syscall.SIGTERM)

	quitSignalReceived := <-quitRequestSignal
	l.Info("shutting down", "signal", quitSignalReceived.String())

	go func() {
		<-quitRequestSignal
		l.Info("force shutting down")
		os.Exit(1)
	}()

	close(shouldQuit)
	quitGroup.Wait()
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
		Secure: true,
		Creds:  miniocredentials.NewStaticV4(cfg.S3.AccessKey, cfg.S3.SecretKey, ""),
	})
	if err != nil {
		log.Fatal(err)
	}
	return objects
}
