package main

import (
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/danielzfranklin/plantopo/matchmaker/internal"
	"github.com/danielzfranklin/plantopo/matchmaker/internal/server"
	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

func main() {
	appEnv := os.Getenv("APP_ENV")
	host := os.Getenv("HOST")
	if host == "" {
		host = "0.0.0.0"
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "4001"
	}
	addr := fmt.Sprintf("%s:%s", host, port)

	var logger *zap.Logger
	var err error
	if os.Getenv("APP_ENV") == "development" {
		logger, err = zap.NewDevelopment()
	} else {
		logger, err = zap.NewProduction()
	}
	if err != nil {
		panic(err)
	}
	defer logger.Sync()
	logger = logger.With(
		zap.String("service", "matchmaker"),
		zap.String("addr", addr),
	)
	zap.ReplaceGlobals(logger)
	l := logger.Sugar()

	var backendDialOptions []grpc.DialOption
	if appEnv == "development" {
		backendDialOptions = append(backendDialOptions,
			grpc.WithTransportCredentials(insecure.NewCredentials()))
	} else {
		// TODO: Add mTLS
		backendDialOptions = append(backendDialOptions,
			grpc.WithTransportCredentials(insecure.NewCredentials()))
	}

	listener, err := net.Listen("tcp", addr)
	if err != nil {
		l.Panicw("Failed to listen", zap.Error(err))
	}

	matchmaker := internal.NewMatchmaker()

	srv, err := server.NewGRPCServer(&server.Config{
		Matchmaker:         matchmaker,
		BackendDialOptions: backendDialOptions,
	})
	if err != nil {
		l.Panicw("Failed to create grpc srv", zap.Error(err))
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

	term := make(chan os.Signal, 1)
	signal.Notify(term, os.Interrupt, syscall.SIGTERM)
	<-term

	l.Info("Stopping srv")
	srv.GracefulStop()
	l.Info("Server stopped")
}
