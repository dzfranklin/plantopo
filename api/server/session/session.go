package session

import (
	"encoding/base64"
	"fmt"
	"net/http"
	"os"

	"github.com/danielzfranklin/plantopo/api/logger"
	"github.com/google/uuid"
	"github.com/gorilla/sessions"
	"go.uber.org/zap"
)

type SessionManager struct {
	store *sessions.CookieStore
}

type Session struct {
	UserId uuid.UUID
}

func NewManager() *SessionManager {
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

	return &SessionManager{store}
}

func (m *SessionManager) Get(r *http.Request) (*Session, error) {
	s, err := m.store.Get(r, "currentUser")
	if err != nil {
		return nil, err
	}
	if s.IsNew {
		return nil, nil
	}
	userIdS, ok := s.Values["userId"].(string)
	if !ok {
		return nil, fmt.Errorf("failed to cast userId session value to string")
	}
	userId, err := uuid.Parse(userIdS)
	if err != nil {
		return nil, fmt.Errorf("failed to parse userId session userid: %w", err)
	}
	return &Session{
		UserId: userId,
	}, nil
}

// Must call before writing to response or returning from handler
func (m *SessionManager) Create(r *http.Request, w http.ResponseWriter, user uuid.UUID) error {
	s, err := m.store.Get(r, "currentUser")
	if err != nil {
		return err
	}
	s.Values["userId"] = user.String()
	s.Save(r, w)
	return nil
}

func (m *SessionManager) Delete(r *http.Request, w http.ResponseWriter) error {
	s, err := m.store.Get(r, "currentUser")
	if err != nil {
		return err
	}
	s.Options.MaxAge = -1
	s.Save(r, w)
	return nil
}
