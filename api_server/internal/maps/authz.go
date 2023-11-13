package maps

import (
	"fmt"
	"strings"

	"github.com/danielzfranklin/plantopo/api_server/internal/types"
	"github.com/google/uuid"
)

type AuthzRequest struct {
	UserId uuid.UUID // uuid.Nil for anonymous
	MapId  string
}

type OpenAuthz struct {
	CanEdit bool
	CanView bool
}

type Action string

var (
	ActionView       Action = "view"
	ActionEdit       Action = "edit"
	ActionViewAccess Action = "viewAccess"
	ActionShare      Action = "share"
	ActionDelete     Action = "delete"
)

// Role is "owner", "editor", or "viewer"
type Role string

// GeneralAccessLevel is "restricted" or "public"
type GeneralAccessLevel string

// GeneralAccessRole is "editor" or "viewer"
type GeneralAccessRole string

const (
	RoleOwner  Role = "owner"
	RoleEditor Role = "editor"
	RoleViewer Role = "viewer"
)

func roleCmp(a Role, b Role) int {
	if a == b {
		return 0
	}

	if a == RoleOwner {
		return 1
	}
	if b == RoleOwner {
		return -1
	}

	if a == RoleEditor {
		return 1
	}
	if b == RoleEditor {
		return -1
	}

	if a == RoleViewer {
		return 1
	}
	if b == RoleViewer {
		return -1
	}

	return 0
}

func roleMax(a Role, b Role) Role {
	if roleCmp(a, b) > 0 {
		return a
	}
	return b
}

type PutAccessRequest struct {
	MapId              string                           `json:"mapId"`
	Owner              *uuid.UUID                       `json:"owner"`
	GeneralAccessLevel GeneralAccessLevel               `json:"generalAccessLevel"`
	GeneralAccessRole  GeneralAccessRole                `json:"generalAccessRole"`
	UserAccess         map[uuid.UUID]PutUserAccessEntry `json:"userAccess"` // by userId
	Invite             []InviteRequest                  `json:"invite"`
}

type PutUserAccessEntry struct {
	Role   Role `json:"role"`
	Delete bool
}

type Access struct {
	MapId              string             `json:"mapId"`
	Owner              *types.User        `json:"owner"`
	GeneralAccessLevel GeneralAccessLevel `json:"generalAccessLevel"`
	GeneralAccessRole  GeneralAccessRole  `json:"generalAccessRole"`
	UserAccess         []UserAccessEntry  `json:"userAccess"`
	PendingInvites     []PendingInvite    `json:"pendingInvites"`
}

type UserAccessEntry struct {
	User types.User `json:"user"`
	Role Role       `json:"role"`
}

type PendingInvite struct {
	Email string `json:"email"`
	Role  Role   `json:"role"`
}

type InviteRequest struct {
	MapId         string `json:"mapId"`
	Email         string `json:"email"`
	Role          Role   `json:"role"`
	Notify        bool   `json:"notify"`
	NotifyMessage string `json:"notifyMessage"`
}

func (r *InviteRequest) Validate() error {
	if r.MapId == "" {
		return fmt.Errorf("missing mapId")
	}
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
