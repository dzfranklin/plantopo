package main

import (
	"context"
	"encoding/base64"
	"errors"
	"flag"
	"fmt"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/danielzfranklin/plantopo/api_server/internal/frontend_map_tokens"
	"github.com/danielzfranklin/plantopo/api_server/internal/loggers"
	"github.com/danielzfranklin/plantopo/api_server/internal/mailer"
	"github.com/danielzfranklin/plantopo/api_server/internal/maps"
	"github.com/danielzfranklin/plantopo/api_server/internal/mapsync"
	"github.com/danielzfranklin/plantopo/api_server/internal/server/routes"
	"github.com/danielzfranklin/plantopo/api_server/internal/server/session"
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

	logger := loggers.Get()
	defer logger.Sync()
	ctx := loggers.WithCtx(context.Background(), logger)
	l := logger.Sugar()

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

	pg, err := db.NewPg(ctx, l.Desugar(), os.Getenv("DATABASE_URL"))
	if err != nil {
		l.Fatalw("error creating postgres pool", zap.Error(err))
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
		mailerConfig.Sender = mailer.NewMailgunSender(l, pg, mailgunKey)

		emailableKey := os.Getenv("PT_EMAILABLE_KEY")
		if emailableKey == "" {
			l.Fatalw("PT_EMAILABLE_KEY must be set")
		}
		mailerConfig.DeliverabilityChecker = mailer.NewEmailableDeliverabilityChecker(ctx, emailableKey)
	}
	mailerService := mailer.New(ctx, mailerConfig)

	usersService := users.NewService(ctx, pg, mailerService)
	mapsService := maps.NewService(l.Desugar(), pg, usersService, mailerService)

	var dialOpts []grpc.DialOption
	var matchmakerTarget string
	if appEnv == "development" {
		dialOpts = []grpc.DialOption{
			grpc.WithTransportCredentials(insecure.NewCredentials()),
		}
		matchmakerTarget = "localhost:4001"
	} else {
		// TODO: Add mTLS
		dialOpts = []grpc.DialOption{
			grpc.WithTransportCredentials(insecure.NewCredentials()),
		}
		matchmakerTarget = "matchmaker:5050"
	}
	syncer, err := mapsync.NewSyncer(matchmakerTarget, dialOpts)
	if err != nil {
		l.Fatalw("error creating syncer", zap.Error(err))
	}

	s3Client := s3.NewFromConfig(awsConfig)
	s3AndPresigner := &s3erAndPresigner{s3Client, s3.NewPresignClient(s3Client)}

	importBucket := os.Getenv("IMPORT_UPLOADS_BUCKET")
	if importBucket == "" {
		l.Fatalw("missing IMPORT_UPLOADS_BUCKET")
	}
	importer := mapsync.NewImporter(&mapsync.ImporterConfig{
		S3:       s3AndPresigner,
		Bucket:   importBucket,
		Importer: syncer,
		Db:       pg,
	})

	router := routes.New(&routes.Services{
		Pg:     pg,
		Users:  usersService,
		Maps:   mapsService,
		Mailer: mailerService,
		SyncConnector: func(ctx context.Context, clientId string, mapId string) (routes.SyncerConnection, error) {
			return syncer.Connect(ctx, clientId, mapId)
		},
		SessionManager: session.NewManager(&session.Config{
			Users:   usersService,
			AuthKey: sessionAuthKey,
		}),
		FrontendMapTokens: frontend_map_tokens.MustFromRaw(frontendMapTokens),
		MapImporter:       importer,
		MapExporter:       syncer,
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

type s3erAndPresigner struct {
	*s3.Client
	*s3.PresignClient
}
