package types

import (
	"time"

	"github.com/google/uuid"
	"github.com/guregu/null"
)

type User struct {
	Id          uuid.UUID `json:"id"`
	Email       string    `json:"email"`
	FullName    string    `json:"fullName"`
	ImageUrl    string    `json:"imageUrl"`
	CreatedAt   time.Time `json:"createdAt,omitempty"`
	ConfirmedAt null.Time `json:"confirmedAt,omitempty"`
}
