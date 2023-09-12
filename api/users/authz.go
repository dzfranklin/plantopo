package users

import (
	"fmt"
	"strings"

	"github.com/google/uuid"
)

type AuthzRequest struct {
	UserId uuid.UUID // uuid.Nil for anonymous
	MapId  uuid.UUID
	Action Action
}

type Action string

var (
	ActionView       Action = "view"
	ActionEdit       Action = "edit"
	ActionViewAccess Action = "viewAccess"
	ActionShare      Action = "share"
	ActionDelete     Action = "delete"
)

type Role string

const (
	RoleOwner  Role = "owner"
	RoleEditor Role = "editor"
	RoleViewer Role = "viewer"
)

type MapAccess struct {
	MapId uuid.UUID `json:"mapId"`
	Owner uuid.UUID `json:"owner"`
	// "restricted" or "public"
	GeneralAccessLevel string `json:"generalAccessLevel"`
	// "editor" or "viewer"
	GeneralAccessRole Role              `json:"generalAccessRole"`
	UserAccess        []UserAccessEntry `json:"userAccess"`
	PendingInvites    []PendingInvite   `json:"pendingInvites"`
}

type UserAccessEntry struct {
	UserId uuid.UUID `json:"userId"`
	Name   string    `json:"name"`
	Email  string    `json:"email"`
	Role   Role      `json:"role"`
}

type PendingInvite struct {
	Email string `json:"email"`
	Role  Role   `json:"role"`
}

type InviteRequest struct {
	MapId         uuid.UUID `json:"mapId"`
	Email         string    `json:"email"`
	Role          Role      `json:"role"`
	Notify        bool      `json:"notify"`
	NotifyMessage string    `json:"notifyMessage"`
}

func (r *InviteRequest) Validate() error {
	if r.Email == "" {
		return fmt.Errorf("missing email")
	} else if !strings.Contains(r.Email, "@") {
		return fmt.Errorf("invalid email")
	}
	if r.Role != RoleEditor && r.Role != RoleViewer {
		return fmt.Errorf("invalid role")
	}
	return nil
}
