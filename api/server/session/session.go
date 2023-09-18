package session

import (
	"encoding/base64"
	"fmt"
	"net/http"
	"os"

	"github.com/danielzfranklin/plantopo/api/logger"
	"github.com/danielzfranklin/plantopo/api/types"
	"github.com/danielzfranklin/plantopo/api/users"
	"github.com/google/uuid"
	"github.com/gorilla/sessions"
	"go.uber.org/zap"
)

type SessionManager struct {
	store *sessions.CookieStore
	users users.Service
}

type Session struct {
	UserId  uuid.UUID
	request *http.Request
	manager *SessionManager
}

func NewManager(users users.Service) *SessionManager {
	authKey := os.Getenv("SESSION_AUTHENTICATION_KEY")
	if authKey == "" {
		panic("SESSION_AUTHENTICATION_KEY must be set")
	}
	authKeyBytes, err := base64.StdEncoding.DecodeString(authKey)
	if err != nil {
		logger.Get().Fatal("failed to decode SESSION_AUTHENTICATION_KEY", zap.Error(err))
	}
	store := sessions.NewCookieStore(authKeyBytes)
	store.Options.HttpOnly = true
	store.Options.Secure = true
	store.Options.SameSite = http.SameSiteStrictMode
	store.Options.MaxAge = 60 * 60 * 24 * 7 * 4 // 1 month

	return &SessionManager{store, users}
}

func (m *SessionManager) Get(r *http.Request) (*Session, error) {
	s, err := m.store.Get(r, "currentUser")
	if err != nil {
		return nil, err
	}
	return m.getSess(r, s)
}

// Must call in handler before writing to response
func (m *SessionManager) Create(r *http.Request, w http.ResponseWriter, user uuid.UUID) error {
	s, err := m.store.Get(r, "currentUser")
	if err != nil {
		return err
	}
	s.Values["userId"] = user.String()
	s.Save(r, w)
	logger.FromR(r).Sugar().Info("created session", "userId", user)
	return nil
}

// Must call in handler before writing to response
func (m *SessionManager) Delete(r *http.Request, w http.ResponseWriter) (*Session, error) {
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
	s.Save(r, w)

	return sess, nil
}

func (m *SessionManager) getSess(r *http.Request, s *sessions.Session) (*Session, error) {
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
	return s.manager.users.Get(s.request.Context(), s.UserId)
}
