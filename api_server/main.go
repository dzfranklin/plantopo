package main

import (
	"context"
	"encoding/base64"
	"errors"
	"flag"
	"fmt"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	api "github.com/danielzfranklin/plantopo/api/v1"
	"github.com/danielzfranklin/plantopo/api_server/internal/frontend_map_tokens"
	"github.com/danielzfranklin/plantopo/api_server/internal/importers"
	"github.com/danielzfranklin/plantopo/api_server/internal/logger"
	"github.com/danielzfranklin/plantopo/api_server/internal/mailer"
	"github.com/danielzfranklin/plantopo/api_server/internal/maps"
	"github.com/danielzfranklin/plantopo/api_server/internal/server/routes"
	"github.com/danielzfranklin/plantopo/api_server/internal/server/session"
	"github.com/danielzfranklin/plantopo/api_server/internal/sync_backends"
	"github.com/danielzfranklin/plantopo/api_server/internal/users"
	"github.com/danielzfranklin/plantopo/db"
	"github.com/google/uuid"
	"github.com/gorilla/securecookie"
	"github.com/joho/godotenv"
	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"syscall"
	"time"
)

func main() {
	uuid.EnableRandPool()

	ul := logger.Get()
	defer ul.Sync()
	ctx := logger.WithCtx(context.Background(), ul)
	l := ul.Sugar()

	appEnv := os.Getenv("APP_ENV")
	if appEnv == "development" {
		for _, f := range []string{".env", ".env.local"} {
			err := godotenv.Load(f)
			if err != nil {
				l.Warnw("error loading env file", "file", f, zap.Error(err))
			}
		}
	}

	genSessionAuthKey := flag.Bool("gen-session-auth-key", false, "")
	devLiveMailer := flag.Bool("dev-live-mailerService", false, "")
	flag.Parse()
	if *genSessionAuthKey {
		key := securecookie.GenerateRandomKey(64)
		fmt.Printf("%s\n", base64.StdEncoding.EncodeToString(key))
		return
	}

	sessionAuthKey := os.Getenv("SESSION_AUTHENTICATION_KEY")
	if sessionAuthKey == "" {
		panic("SESSION_AUTHENTICATION_KEY must be set")
	}

	frontendMapTokens := os.Getenv("PT_FRONTEND_MAP_TOKENS")
	if frontendMapTokens == "" {
		panic("missing env var PT_FRONTEND_MAP_TOKENS")
	}

	host := os.Getenv("HOST")
	if host == "" {
		host = "0.0.0.0"
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "4000"
	}
	l = l.With(zap.String("host", host), zap.String("port", port))
	l.Infow("starting")

	awsConfig, err := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion("eu-west-2"))
	if err != nil {
		l.Fatalw("error loading aws config", zap.Error(err))
	}

	mailerConfig := mailer.Config{
		Sender:                &mailer.LogSender{Logger: l},
		DeliverabilityChecker: &mailer.NoopDeliverabilityChecker{},
	}
	if appEnv == "production" || (appEnv == "development" && *devLiveMailer) {
		mailgunKey := os.Getenv("PT_MAILGUN_KEY")
		if mailgunKey == "" {
			l.Fatalw("PT_MAILGUN_KEY must be set")
		}
		mailerConfig.Sender = mailer.NewMailgunSender(l, mailgunKey)

		emailableKey := os.Getenv("PT_EMAILABLE_KEY")
		if emailableKey == "" {
			l.Fatalw("PT_EMAILABLE_KEY must be set")
		}
		mailerConfig.DeliverabilityChecker = mailer.NewEmailableDeliverabilityChecker(ctx, emailableKey)
	}
	mailerService := mailer.New(ctx, mailerConfig)

	pg, err := db.NewPg(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		l.Fatalw("error creating postgres pool", zap.Error(err))
	}

	usersService := users.NewService(ctx, pg, mailerService)
	mapsService := maps.NewService(l.Desugar(), pg, usersService, mailerService)

	var dialOpts []grpc.DialOption
	var matchAddr string
	if appEnv == "development" {
		dialOpts = []grpc.DialOption{
			grpc.WithTransportCredentials(insecure.NewCredentials()),
		}
		matchAddr = "localhost:4001"
	} else {
		// TODO: Add mTLS
		dialOpts = []grpc.DialOption{
			grpc.WithTransportCredentials(insecure.NewCredentials()),
		}
		matchAddr = "matchmaker:5050"
	}
	matchCC, err := grpc.Dial(matchAddr, dialOpts...)
	if err != nil {
		l.Fatalw("Failed to dial matchmaker", zap.Error(err))
	}
	matchmaker := api.NewMatchmakerClient(matchCC)

	syncBackends := sync_backends.NewProvider(&sync_backends.Config{
		DialOpts: dialOpts,
	})

	s3Client := s3.NewFromConfig(awsConfig)

	importer, err := importers.New(&importers.Config{
		ObjectStore:  importers.NewS3ObjectStore(s3Client),
		Matchmaker:   matchmaker,
		SyncBackends: syncBackends,
		Db:           pg,
	})
	if err != nil {
		l.Fatalw("error creating importer", zap.Error(err))
	}

	router := routes.New(&routes.Services{
		Pg:           pg,
		Users:        usersService,
		Maps:         mapsService,
		Mailer:       mailerService,
		Matchmaker:   matchmaker,
		SyncBackends: syncBackends,
		SessionManager: session.NewManager(&session.Config{
			Users:   usersService,
			AuthKey: sessionAuthKey,
		}),
		FrontendMapTokens: frontend_map_tokens.MustFromRaw(frontendMapTokens),
		MapImporter:       importer,
	})
	server := &http.Server{
		Addr:    fmt.Sprintf(":%s", port),
		Handler: router,
	}

	go func() {
		l.Infow("starting http server")
		err := server.ListenAndServe()
		if errors.Is(err, http.ErrServerClosed) {
			l.Infow("http server closed")
		} else {
			l.Fatalw("http server error", zap.Error(err))
		}
	}()

	term := make(chan os.Signal, 1)
	signal.Notify(term, os.Interrupt, syscall.SIGTERM)
	<-term
	l.Info("shutting down")

	gracefulShutdownDone := make(chan struct{}, 1)
	go func() {
		cancelCtx, cancelCancel := context.WithTimeout(ctx, time.Second*15)
		defer cancelCancel()
		if err := server.Shutdown(cancelCtx); err != nil {
			l.Fatalw("server shutdown error", zap.Error(err))
		}

		l.Infow("server shutdown complete")
		gracefulShutdownDone <- struct{}{}
	}()

	select {
	case <-gracefulShutdownDone:
		return
	case <-time.After(time.Second * 30):
		stackBuf := make([]byte, 1024*1024)
		length := runtime.Stack(stackBuf, true)
		stack := string(stackBuf[:length])

		l.Error("graceful server shutdown timed out", zap.String("stack", stack))
		fmt.Println(stack)
		l.Fatalw("graceful server shutdown timed out")
	}
}
