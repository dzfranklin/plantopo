package session

import (
	"encoding/base64"
	"fmt"
	"net/http"
	"os"

	"github.com/danielzfranklin/plantopo/api_server/internal/loggers"
	"github.com/danielzfranklin/plantopo/api_server/internal/types"
	"github.com/danielzfranklin/plantopo/api_server/internal/users"
	"github.com/google/uuid"
	"github.com/gorilla/sessions"
	"go.uber.org/zap"
)

type Manager struct {
	store *sessions.CookieStore
	*Config
}

type Session struct {
	UserId  uuid.UUID
	request *http.Request
	manager *Manager
}

type Config struct {
	Users   users.Service
	AuthKey string
}

func NewManager(config *Config) *Manager {
	authKey := os.Getenv("SESSION_AUTHENTICATION_KEY")
	if config.AuthKey == "" {
		panic("config.AuthKey must be set")
	}

	authKeyBytes, err := base64.StdEncoding.DecodeString(authKey)
	if err != nil {
		loggers.Get().Fatal("failed to decode SESSION_AUTHENTICATION_KEY", zap.Error(err))
	}
	store := sessions.NewCookieStore(authKeyBytes)
	store.Options.HttpOnly = true
	store.Options.Secure = true
	store.Options.SameSite = http.SameSiteStrictMode
	store.Options.MaxAge = 60 * 60 * 24 * 7 * 4 // 1 month

	return &Manager{store, config}
}

func (m *Manager) Get(r *http.Request) (*Session, error) {
	s, err := m.store.Get(r, "currentUser")
	if err != nil {
		return nil, err
	}
	return m.getSess(r, s)
}

// Create must be called in the handler before writing to response
func (m *Manager) Create(r *http.Request, w http.ResponseWriter, user uuid.UUID) error {
	s, err := m.store.Get(r, "currentUser")
	if err != nil {
		return err
	}
	s.Values["userId"] = user.String()
	err = s.Save(r, w)
	if err != nil {
		return err
	}
	loggers.FromR(r).Sugar().Info("created session", "userId", user)
	return nil
}

// Delete must be called in the handler before writing to response
func (m *Manager) Delete(r *http.Request, w http.ResponseWriter) (*Session, error) {
	s, err := m.store.Get(r, "currentUser")
	if err != nil {
		return nil, err
	}

	sess, err := m.getSess(r, s)
	if err != nil {
		return nil, err
	}
	if sess == nil {
		return nil, nil
	}

	s.Options.MaxAge = -1
	err = s.Save(r, w)
	if err != nil {
		return nil, err
	}

	return sess, nil
}

func (m *Manager) getSess(r *http.Request, s *sessions.Session) (*Session, error) {
	if s.IsNew {
		return nil, nil
	}
	idS, ok := s.Values["userId"].(string)
	if !ok {
		return nil, fmt.Errorf("failed to cast userId session value to string")
	}
	id, err := uuid.Parse(idS)
	if err != nil {
		return nil, fmt.Errorf("failed to parse userId session userid: %w", err)
	}
	return &Session{UserId: id, manager: m, request: r}, nil
}

func (s *Session) GetUser() (*types.User, error) {
	return s.manager.Users.Get(s.request.Context(), s.UserId)
}
