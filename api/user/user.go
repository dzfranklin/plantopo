package user

import (
	"time"

	"github.com/google/uuid"
	"github.com/guregu/null"
)

type User struct {
	Id          uuid.UUID `json:"id,omitempty"`
	Email       string    `json:"email,omitempty"`
	FullName    string    `json:"fullName,omitempty"`
	CreatedAt   time.Time `json:"createdAt,omitempty"`
	ConfirmedAt null.Time `json:"confirmedAt,omitempty"`
}
