package maps

import (
	"context"
	"errors"
	"fmt"

	"github.com/danielzfranklin/plantopo/api/db"
	"github.com/danielzfranklin/plantopo/api/mailer"
	"github.com/danielzfranklin/plantopo/api/types"
	"github.com/danielzfranklin/plantopo/api/users"
	"github.com/google/uuid"
	"github.com/guregu/null"
	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"
)

type Service interface {
	Get(ctx context.Context, id uuid.UUID) (types.MapMeta, error)
	Create(ctx context.Context, owner uuid.UUID) (types.MapMeta, error)
	Put(ctx context.Context, update MetaUpdateRequest) (types.MapMeta, error)
	Delete(ctx context.Context, ids []uuid.UUID) error
	ListOwnedBy(ctx context.Context, userId uuid.UUID) ([]types.MapMeta, error)
	ListSharedWith(ctx context.Context, userId uuid.UUID) ([]types.MapMeta, error)
	IsAuthorized(ctx context.Context, req AuthzRequest, action Action) bool
	CheckOpen(ctx context.Context, req AuthzRequest) (*OpenAuthz, error)
	Access(ctx context.Context, mapId uuid.UUID) (*Access, error)
	PutAccess(ctx context.Context, from *types.User, req PutAccessRequest) error
	Invite(ctx context.Context, from *types.User, req InviteRequest) error
}

var ErrMapNotFound = errors.New("map not found")

type impl struct {
	pg     *db.Pg
	l      *zap.Logger
	users  users.Service
	mailer mailer.Service
}

func NewService(
	l *zap.Logger,
	pg *db.Pg,
	users users.Service,
	mailer mailer.Service,
) Service {
	l = l.Named("map_meta")
	s := &impl{
		pg:     pg,
		l:      l,
		users:  users,
		mailer: mailer,
	}
	return s
}

func (s *impl) Get(ctx context.Context, id uuid.UUID) (types.MapMeta, error) {
	if id == uuid.Nil {
		return types.MapMeta{}, errors.New("id is required")
	}
	var meta types.MapMeta
	err := s.pg.QueryRow(ctx,
		`SELECT id, name, created_at
			FROM maps
			WHERE id = $1 AND deleted_at IS NULL`,
		id,
	).Scan(&meta.Id, &meta.Name, &meta.CreatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return types.MapMeta{}, ErrMapNotFound
		}
		return types.MapMeta{}, err
	}
	return meta, nil
}

func (s *impl) Create(ctx context.Context, owner uuid.UUID) (types.MapMeta, error) {
	tx, err := s.pg.Begin(ctx)
	if err != nil {
		s.l.DPanic("failed to begin transaction", zap.Error(err))
		return types.MapMeta{}, err
	}
	defer tx.Rollback(ctx)

	var meta types.MapMeta
	err = s.pg.QueryRow(ctx,
		`INSERT INTO maps DEFAULT VALUES RETURNING id, name, created_at`,
	).Scan(&meta.Id, &meta.Name, &meta.CreatedAt)
	if err != nil {
		return types.MapMeta{}, err
	}

	err = s.grant(ctx, meta.Id, owner, RoleOwner)
	if err != nil {
		return types.MapMeta{}, err
	}

	err = tx.Commit(ctx)
	if err != nil {
		return types.MapMeta{}, err
	}

	return meta, nil
}

func (s *impl) Put(ctx context.Context, update MetaUpdateRequest) (types.MapMeta, error) {
	if update.Id == uuid.Nil {
		return types.MapMeta{}, errors.New("id is required")
	}
	var meta types.MapMeta
	err := s.pg.QueryRow(ctx,
		`UPDATE maps
			SET name = $2
			WHERE id = $1 AND deleted_at IS NULL
			RETURNING id, name, created_at`,
		update.Id, update.Name,
	).Scan(&meta.Id, &meta.Name, &meta.CreatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return types.MapMeta{}, ErrMapNotFound
		}
		return types.MapMeta{}, err
	}
	return meta, nil
}

func (s *impl) Delete(ctx context.Context, ids []uuid.UUID) error {
	rows, err := s.pg.Query(ctx,
		`UPDATE maps SET deleted_at = NOW()
			WHERE id = ANY($1) AND deleted_at IS NULL`,
		ids,
	)
	if err != nil {
		return err
	}
	defer rows.Close()
	return nil
}

func (s *impl) ListOwnedBy(ctx context.Context, userId uuid.UUID) ([]types.MapMeta, error) {
	if userId == uuid.Nil {
		return nil, errors.New("userId is required")
	}
	rows, err := s.pg.Query(ctx,
		`SELECT id, name, created_at FROM maps
			WHERE
				id IN (SELECT map_id FROM map_roles
					WHERE user_id = $1 AND my_role = 'owner')
				AND deleted_at IS NULL
			ORDER BY created_at DESC`,
		userId,
	)
	if err != nil {
		s.l.DPanic("failed to query maps", zap.Error(err))
		return nil, err
	}
	defer rows.Close()
	list := make([]types.MapMeta, 0)
	for rows.Next() {
		var meta types.MapMeta
		err := rows.Scan(&meta.Id, &meta.Name, &meta.CreatedAt)
		if err != nil {
			s.l.DPanic("failed to scan maps", zap.Error(err))
			return nil, err
		}
		list = append(list, meta)
	}
	return list, nil
}

func (s *impl) ListSharedWith(ctx context.Context, userId uuid.UUID) ([]types.MapMeta, error) {
	if userId == uuid.Nil {
		return nil, errors.New("userId is required")
	}
	rows, err := s.pg.Query(ctx,
		`SELECT id, name, created_at FROM maps
			WHERE
				id IN (SELECT map_id FROM map_roles
					WHERE user_id = $1 AND my_role != 'owner')
				AND deleted_at IS NULL
			ORDER BY created_at DESC`,
		userId,
	)
	if err != nil {
		s.l.DPanic("failed to query maps", zap.Error(err))
		return nil, err
	}
	defer rows.Close()
	list := make([]types.MapMeta, 0)
	for rows.Next() {
		var meta types.MapMeta
		err := rows.Scan(&meta.Id, &meta.Name, &meta.CreatedAt)
		if err != nil {
			s.l.DPanic("failed to scan maps", zap.Error(err))
			return nil, err
		}
		list = append(list, meta)
	}
	return list, nil
}

func (r *impl) IsAuthorized(
	ctx context.Context, req AuthzRequest, action Action,
) bool {
	role, err := r.getRole(ctx, req)
	if err != nil {
		r.l.DPanic("failed to get role", zap.Error(err))
		return false
	}
	if role == "" {
		r.l.Debug("no role",
			zap.String("mapId", req.MapId.String()),
			zap.String("userId", req.UserId.String()))
		return false
	}
	switch action {
	case ActionView:
		return role == RoleOwner || role == RoleEditor || role == RoleViewer
	case ActionEdit:
		return role == RoleOwner || role == RoleEditor
	case ActionViewAccess:
		return role == RoleOwner
	case ActionShare:
		return role == RoleOwner
	case ActionDelete:
		return role == RoleOwner
	default:
		r.l.Info("unknown action", zap.String("action", string(action)))
		return false
	}
}

func (r *impl) CheckOpen(ctx context.Context, req AuthzRequest) (*OpenAuthz, error) {
	role, err := r.getRole(ctx, req)
	if err != nil {
		return nil, err
	} else if role == "" {
		var exists bool
		err := r.pg.QueryRow(ctx,
			`SELECT EXISTS(
				SELECT 1 FROM maps
					WHERE id = $1 AND deleted_at IS NULL)`,
			req.MapId,
		).Scan(&exists)
		if err != nil {
			return nil, err
		}
		if !exists {
			return nil, ErrMapNotFound
		}
	}

	authz := &OpenAuthz{}
	if role == RoleOwner || role == RoleEditor {
		authz.CanEdit = true
		authz.CanView = true
	} else if role == RoleViewer {
		authz.CanView = true
	}
	return authz, nil
}

func (r *impl) getRole(ctx context.Context, req AuthzRequest) (Role, error) {
	if req.MapId == uuid.Nil {
		r.l.Info("IsAuthorized called with null mapId")
		return "", nil
	}

	var row pgx.Row
	if req.UserId == uuid.Nil {
		row = r.pg.QueryRow(ctx,
			`SELECT general_access_role FROM maps
				WHERE id = $1
					AND general_access_level = 'public'
					AND deleted_at IS NULL`,
			req.MapId,
		)
	} else {
		row = r.pg.QueryRow(ctx,
			`SELECT map_roles.my_role FROM map_roles
				INNER JOIN maps ON maps.id = map_roles.map_id
				WHERE map_roles.map_id = $1 AND map_roles.user_id = $2
					AND maps.deleted_at IS NULL
			`,
			req.MapId, req.UserId,
		)
	}
	var role Role
	err := row.Scan(&role)
	if err != nil {
		if err == pgx.ErrNoRows {
			return "", nil
		} else {
			return "", err
		}
	}
	return role, nil
}

func (r *impl) Access(ctx context.Context, mapId uuid.UUID) (*Access, error) {
	out := &Access{
		MapId:          mapId,
		UserAccess:     make([]UserAccessEntry, 0),
		PendingInvites: make([]PendingInvite, 0),
	}

	var deletedAt null.Time
	err := r.pg.QueryRow(ctx,
		`SELECT deleted_at, general_access_level, general_access_role FROM maps
			WHERE id = $1`,
		mapId,
	).Scan(&deletedAt, &out.GeneralAccessLevel, &out.GeneralAccessRole)
	if err != nil {
		return nil, err
	}
	if deletedAt.Valid {
		return nil, ErrMapNotFound
	}

	roles, err := r.listRoles(ctx, mapId)
	if err != nil {
		return nil, err
	}

	roleUsersIds := make([]uuid.UUID, 0)
	for _, role := range roles {
		roleUsersIds = append(roleUsersIds, role.userId)
	}
	roleUsers, err := r.users.GetEach(ctx, roleUsersIds)
	if err != nil {
		return nil, err
	}

	for _, roleEntry := range roles {
		user := roleUsers[roleEntry.userId]
		if roleEntry.userId != user.Id {
			r.l.Panic("roleEntry.userId != user.Id")
		}
		if roleEntry.role == RoleOwner {
			if out.Owner != nil {
				r.l.Panic("multiple owners")
			}
			out.Owner = &user
		} else {
			out.UserAccess = append(out.UserAccess, UserAccessEntry{
				User: user,
				Role: roleEntry.role,
			})
		}
	}

	rows, err := r.pg.Query(ctx,
		`SELECT email, my_role FROM pending_map_invites
			WHERE map_id = $1
			ORDER BY created_at ASC`,
		mapId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		invite := PendingInvite{}
		rows.Scan(&invite.Email, &invite.Role)
		out.PendingInvites = append(out.PendingInvites, invite)
	}

	return out, nil
}

func (r *impl) PutAccess(ctx context.Context, from *types.User, req PutAccessRequest) error {
	if req.MapId == uuid.Nil {
		return errors.New("mapId is required")
	}

	tx, err := r.pg.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var deletedAt null.Time
	err = tx.QueryRow(ctx, `SELECT deleted_at FROM maps
		WHERE id = $1
		FOR UPDATE`, req.MapId).Scan(&deletedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return ErrMapNotFound
		}
		return err
	} else if deletedAt.Valid {
		return ErrMapNotFound
	}

	if req.Owner != nil {
		_, err = tx.Exec(ctx,
			`DELETE FROM map_roles WHERE map_id = $1 AND my_role = 'owner'`,
			req.MapId)
		if err != nil {
			return err
		}

		r.grant(ctx, req.MapId, *req.Owner, RoleOwner)
		if err != nil {
			return err
		}
	}

	if req.GeneralAccessLevel != "" {
		_, err = tx.Exec(ctx,
			`UPDATE maps SET general_access_level = $2
				WHERE id = $1`,
			req.MapId, req.GeneralAccessLevel)
		if err != nil {
			return err
		}
	}

	if req.GeneralAccessRole != "" {
		_, err = tx.Exec(ctx,
			`UPDATE maps SET general_access_role = $2
				WHERE id = $1`,
			req.MapId, req.GeneralAccessRole)
		if err != nil {
			return err
		}
	}

	for userId, entry := range req.UserAccess {
		if entry.Delete {
			_, err = tx.Exec(ctx,
				`DELETE FROM map_roles
					WHERE map_id = $1 AND user_id = $2`,
				req.MapId, userId)
			if err != nil {
				return err
			}
		} else {
			if entry.Role == "" {
				return errors.New("role is required")
			} else if entry.Role == RoleOwner {
				return errors.New("cannot set to owner via user access")
			}
			err = r.grant(ctx, req.MapId, userId, entry.Role)
			if err != nil {
				return err
			}
		}
	}

	err = tx.Commit(ctx)
	if err != nil {
		return err
	}

	if len(req.Invite) > 0 {
		meta, err := r.Get(ctx, req.MapId)
		if err != nil {
			return err
		}

		for _, invite := range req.Invite {
			invite.MapId = req.MapId
			err := r.invite(ctx, from, meta, invite)
			if err != nil {
				return fmt.Errorf("failed to invite: %w", err)
			}
		}
	}

	return nil
}

type roleEntry struct {
	userId uuid.UUID
	role   Role
}

func (r *impl) listRoles(ctx context.Context, mapId uuid.UUID) ([]roleEntry, error) {
	rows, err := r.pg.Query(ctx,
		`SELECT user_id, my_role FROM map_roles
			WHERE map_id = $1
			ORDER BY created_at ASC`,
		mapId,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	roles := make([]roleEntry, 0)
	for rows.Next() {
		var userId uuid.UUID
		var role Role
		err := rows.Scan(&userId, &role)
		if err != nil {
			return nil, err
		}

		roles = append(roles, roleEntry{userId: userId, role: role})
	}
	return roles, nil
}

func (r *impl) Invite(ctx context.Context, from *types.User, req InviteRequest) error {
	meta, err := r.Get(ctx, req.MapId)
	if err != nil {
		return err
	}
	return r.invite(ctx, from, meta, req)
}

func (r *impl) invite(
	ctx context.Context,
	from *types.User,
	meta types.MapMeta,
	req InviteRequest,
) error {
	if err := req.Validate(); err != nil {
		r.l.Info("invalid invite request", zap.Error(err))
		return err
	}

	var deletedAt null.Time
	err := r.pg.QueryRow(ctx, `SELECT deleted_at FROM maps
		WHERE id = $1`, req.MapId).Scan(&deletedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return ErrMapNotFound
		}
		return err
	} else if deletedAt.Valid {
		return ErrMapNotFound
	}

	to, err := r.users.GetByEmail(ctx, req.Email)
	if err != nil && err != users.ErrNotFound {
		return err
	}

	if err == users.ErrNotFound {
		r.l.Info("inviting new user to map",
			zap.String("mapId", req.MapId.String()))

		// Always notify new users
		r.mailer.SendInvite(mailer.InviteRequest{
			From:    from,
			ToEmail: req.Email,
			Map:     &meta,
			Message: req.NotifyMessage,
		})

		_, err = r.pg.Exec(ctx,
			`INSERT INTO pending_map_invites (map_id, email, my_role)
				VALUES ($1, $2, $3)
				ON CONFLICT (map_id, email)
					DO UPDATE SET my_role = $3`,
			req.MapId, req.Email, req.Role)
		if err != nil {
			return err
		}

		return nil
	} else {
		r.l.Info("inviting existing user to map",
			zap.String("mapId", req.MapId.String()))

		err := r.grant(ctx, req.MapId, to.Id, req.Role)
		if err != nil {
			return err
		}

		if req.Notify {
			r.mailer.SendShareNotification(mailer.ShareNotificationRequest{
				From:    from,
				To:      to,
				Map:     &meta,
				Message: req.NotifyMessage,
			})
		}
		return nil
	}
}

func (r *impl) grant(
	ctx context.Context, mapId uuid.UUID, userId uuid.UUID, role Role,
) error {
	_, err := r.pg.Exec(ctx,
		`INSERT INTO map_roles (map_id, user_id, my_role)
			VALUES ($1, $2, $3)
			ON CONFLICT (map_id, user_id)
				DO UPDATE SET my_role = $3`,
		mapId, userId, role,
	)
	if err != nil {
		return err
	}
	return nil
}
