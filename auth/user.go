package auth

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
)

type User struct {
	Id          uuid.UUID
	Email       string
	FullName    string
	CreatedAt   time.Time
	ConfirmedAt sql.NullTime
}
