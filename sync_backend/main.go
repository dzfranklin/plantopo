package main

import (
	"context"
	"errors"
	"fmt"
	"go.uber.org/zap/zapcore"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	api "github.com/danielzfranklin/plantopo/api/v1"
	"github.com/danielzfranklin/plantopo/db"
	"github.com/danielzfranklin/plantopo/sync_backend/internal"
	"github.com/danielzfranklin/plantopo/sync_backend/internal/backend"
	"github.com/danielzfranklin/plantopo/sync_backend/internal/repo"
	"github.com/danielzfranklin/plantopo/sync_backend/internal/server"
	"github.com/danielzfranklin/plantopo/sync_backend/internal/session"
	"github.com/joho/godotenv"
	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

func main() {
	appEnv := os.Getenv("APP_ENV")
	if appEnv == "development" {
		err := godotenv.Load("../.env")
		if err != nil {
			log.Fatal("Error loading .env file", err)
		}
	}

	host := os.Getenv("HOST")
	if host == "" {
		host = "0.0.0.0"
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "4010"
	}

	selfExternalAddr := os.Getenv("SELF_EXTERNAL_ADDR")
	if selfExternalAddr == "" {
		if appEnv == "development" {
			selfExternalAddr = fmt.Sprintf("%s:%s", host, port)
		} else {
			panic("SELF_EXTERNAL_ADDR must be set (unless APP_ENV is development)")
		}
	}

	zapConfig := zap.NewProductionConfig()
	zapConfig.EncoderConfig.EncodeTime = zapcore.TimeEncoderOfLayout(time.RFC3339)
	if appEnv == "development" {
		zapConfig = zap.NewDevelopmentConfig()
	}
	logger, err := zapConfig.Build()
	if err != nil {
		log.Fatal(err)
	}
	defer logger.Sync()
	logger = logger.With(
		zap.String("service", "sync_backend"),
		zap.String("selfExternalAddr", selfExternalAddr),
	)
	zap.ReplaceGlobals(logger)
	l := logger.Sugar()

	pg, err := db.NewPg(context.Background(), os.Getenv("DATABASE_URL"))
	if err != nil {
		l.Fatalw("error creating postgres pool", zap.Error(err))
	}
	l.Infow("checking postgres")
	if err := pg.Ping(context.Background()); err != nil {
		l.Fatalw("error pinging postgres", zap.Error(err))
	}
	r := repo.New(pg)

	var grpcClientOptions []grpc.DialOption
	if appEnv == "development" {
		grpcClientOptions = append(grpcClientOptions,
			grpc.WithTransportCredentials(insecure.NewCredentials()))
	} else {
		// TODO: Add mTLS
		grpcClientOptions = append(grpcClientOptions,
			grpc.WithTransportCredentials(insecure.NewCredentials()))
	}
	var matchmakerAddr string
	if appEnv == "development" {
		matchmakerAddr = "localhost:4001"
	} else {
		matchmakerAddr = "matchmaker:5050"
	}
	matchmakerCC, err := grpc.Dial(matchmakerAddr, grpcClientOptions...)
	if err != nil {
		l.Panicw("Failed to dial matchmaker", zap.Error(err))
	}
	matchmakerC := api.NewMatchmakerClient(matchmakerCC)
	matchmaker := internal.NewMatchmaker(matchmakerC)

	b := backend.New(&backend.Config{
		ExternalAddr: selfExternalAddr,
		Matchmaker:   matchmaker,
		Session: &session.Config{
			Repo: r,
		},
	})

	srv, err := server.NewGRPCServer(&server.Config{
		Backend: b,
	})
	if err != nil {
		l.Panicw("Failed to create grpc srv", zap.Error(err))
	}

	listener, err := net.Listen("tcp", fmt.Sprintf("%s:%s", host, port))
	if err != nil {
		l.Panicw("Failed to listen", zap.Error(err))
	}

	go func() {
		l.Info("Starting grpc srv")
		err := srv.Serve(listener)
		if errors.Is(err, http.ErrServerClosed) {
			l.Info("grpc srv closed")
		} else if err != nil {
			l.Errorw("grpc srv error", zap.Error(err))
		}
	}()

	l.Infow("Registering with matchmaker", "matchmakerAddr", matchmakerAddr)
	err = matchmaker.RegisterBackend(context.Background(), selfExternalAddr)
	if err != nil {
		l.Fatalw("Failed to register with matchmaker", zap.Error(err))
	}

	term := make(chan os.Signal, 1)
	signal.Notify(term, os.Interrupt, syscall.SIGTERM)
	<-term

	l.Info("Stopping srv")
	didStopServer := make(chan struct{})
	go func() {
		srv.GracefulStop()
		close(didStopServer)
	}()
	serverStopTimeout := time.NewTimer(15 * time.Second)
	defer serverStopTimeout.Stop()
	select {
	case <-didStopServer:
		l.Info("Server stopped")
	case <-serverStopTimeout.C:
		l.Error("Server stop timed out")
	}

	l.Info("Unregistering from matchmaker")
	err = matchmaker.UnregisterBackend(context.Background(), selfExternalAddr)
	if err != nil {
		l.Errorw("Failed to unregister from matchmaker", zap.Error(err))
	}

	l.Info("Shutdown complete")
}
