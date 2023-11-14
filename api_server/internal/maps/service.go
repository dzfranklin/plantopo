package maps

import (
	"context"
	"errors"
	"fmt"
	"github.com/danielzfranklin/plantopo/api_server/internal/mailer"
	"github.com/danielzfranklin/plantopo/api_server/internal/queries"
	"github.com/danielzfranklin/plantopo/api_server/internal/types"
	"github.com/danielzfranklin/plantopo/api_server/internal/users"
	"github.com/danielzfranklin/plantopo/db"
	"github.com/google/uuid"
	"github.com/guregu/null"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/oklog/ulid/v2"
	"go.uber.org/zap"
)

type Service interface {
	Get(ctx context.Context, id string) (types.MapMeta, error)
	Create(ctx context.Context, owner uuid.UUID) (types.MapMeta, error)
	CreateCopy(ctx context.Context, copyFrom string) (types.MapMeta, error)
	Put(ctx context.Context, update MetaUpdateRequest) (types.MapMeta, error)
	Delete(ctx context.Context, ids []string) error
	ListOwnedBy(ctx context.Context, userId uuid.UUID) ([]types.MapMeta, error)
	ListSharedWith(ctx context.Context, userId uuid.UUID) ([]types.MapMeta, error)
	IsAuthorized(ctx context.Context, req AuthzRequest, action Action) bool
	CheckOpen(ctx context.Context, req AuthzRequest) (*OpenAuthz, error)
	Access(ctx context.Context, mapId string) (*Access, error)
	PutAccess(ctx context.Context, from *types.User, req PutAccessRequest) error
	Invite(ctx context.Context, from *types.User, req InviteRequest) error
	RequestAccess(ctx context.Context, req RequestAccessRequest) error
	ListPendingAccessRequestsToRecipient(ctx context.Context, recipientId uuid.UUID) ([]PendingAccessRequest, error)
	ApproveAccessRequestIfAuthorized(ctx context.Context, approvingUser *types.User, id string) error
	RejectAccessRequestIfAuthorized(ctx context.Context, rejectingUser *types.User, id string) error
}

var ErrMapNotFound = errors.New("map not found")

type impl struct {
	pg     *db.Pg
	q      *queries.Queries
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

	pg.AddAfterConnectHandler(func(ctx context.Context, conn *pgx.Conn) error {
		dataTypeNames := []string{
			"my_role", "general_access_level", "general_access_role",
		}
		for _, typeName := range dataTypeNames {
			dataType, err := conn.LoadType(ctx, typeName)
			if err != nil {
				return err
			}
			conn.TypeMap().RegisterType(dataType)
		}

		conn.TypeMap().RegisterDefaultPgType(Role(""), "my_role")
		conn.TypeMap().RegisterDefaultPgType(GeneralAccessLevel(""), "general_access_level")
		conn.TypeMap().RegisterDefaultPgType(GeneralAccessRole(""), "general_access_role")

		return nil
	})
	pg.Reset()

	s := &impl{
		pg:     pg,
		q:      queries.New(pg),
		l:      l,
		users:  users,
		mailer: mailer,
	}
	return s
}

func (s *impl) Get(ctx context.Context, id string) (types.MapMeta, error) {
	if id == "" {
		return types.MapMeta{}, errors.New("id is required")
	}
	meta := types.MapMeta{Id: id}
	err := s.pg.QueryRow(ctx,
		`SELECT name, created_at
			FROM maps
			WHERE external_id = $1 AND deleted_at IS NULL`,
		id,
	).Scan(&meta.Name, &meta.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
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

	id := ulid.Make().String()

	meta := types.MapMeta{Id: id}
	err = s.pg.QueryRow(ctx,
		`INSERT INTO maps (external_id) VALUES ($1) RETURNING name, created_at`,
		id,
	).Scan(&meta.Name, &meta.CreatedAt)
	if err != nil {
		return types.MapMeta{}, err
	}

	if owner != uuid.Nil {
		err = grant(ctx, tx, meta.Id, owner, RoleOwner)
		if err != nil {
			return types.MapMeta{}, err
		}
	}

	err = tx.Commit(ctx)
	if err != nil {
		return types.MapMeta{}, err
	}

	return meta, nil
}

func (s *impl) CreateCopy(ctx context.Context, copyFrom string) (created types.MapMeta, err error) {
	var sourceMeta types.MapMeta
	if sourceMeta, err = s.Get(ctx, copyFrom); err != nil {
		return
	}

	var sourceAccess *Access
	if sourceAccess, err = s.Access(ctx, copyFrom); err != nil {
		return
	}

	var target types.MapMeta
	if target, err = s.Create(ctx, uuid.Nil); err != nil {
		return
	}

	if target, err = s.Put(ctx, MetaUpdateRequest{
		Id:   target.Id,
		Name: sourceMeta.Name + " (copy)",
	}); err != nil {
		s.l.Error("failed to copy meta", zap.Error(err))
	}

	putUserAccess := make(map[uuid.UUID]PutUserAccessEntry)
	for _, entry := range sourceAccess.UserAccess {
		if entry.Role == RoleOwner {
			continue
		}
		putUserAccess[entry.User.Id] = PutUserAccessEntry{
			Role: entry.Role,
		}
	}
	putInvites := make([]InviteRequest, 0)
	for _, invite := range sourceAccess.PendingInvites {
		putInvites = append(putInvites, InviteRequest{
			Email:  invite.Email,
			Role:   invite.Role,
			Notify: false,
		})
	}
	if err = s.PutAccess(ctx, nil, PutAccessRequest{
		MapId:              target.Id,
		Owner:              &sourceAccess.Owner.Id,
		GeneralAccessLevel: sourceAccess.GeneralAccessLevel,
		GeneralAccessRole:  sourceAccess.GeneralAccessRole,
		UserAccess:         putUserAccess,
		Invite:             putInvites,
	}); err != nil {
		s.l.Error("failed to copy access", zap.Error(err))
	}

	return target, nil
}

func (s *impl) Put(ctx context.Context, update MetaUpdateRequest) (types.MapMeta, error) {
	if update.Id == "" {
		return types.MapMeta{}, errors.New("id is required")
	}
	meta := types.MapMeta{Id: update.Id}
	err := s.pg.QueryRow(ctx,
		`UPDATE maps
			SET name = $2
			WHERE external_id = $1 AND deleted_at IS NULL
			RETURNING name, created_at`,
		update.Id, update.Name,
	).Scan(&meta.Name, &meta.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return types.MapMeta{}, ErrMapNotFound
		}
		return types.MapMeta{}, err
	}
	return meta, nil
}

func (s *impl) Delete(ctx context.Context, ids []string) error {
	rows, err := s.pg.Query(ctx,
		`UPDATE maps SET deleted_at = NOW()
			WHERE external_id = ANY($1) AND deleted_at IS NULL`,
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
		`SELECT external_id, name, created_at FROM maps
			WHERE
				internal_id IN (SELECT map_id FROM map_roles
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
		`SELECT external_id, name, created_at FROM maps
			WHERE
				maps.internal_id IN (SELECT map_id FROM map_roles
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

func (s *impl) IsAuthorized(
	ctx context.Context, req AuthzRequest, action Action,
) bool {
	role, err := s.getRole(ctx, req)
	if err != nil {
		s.l.DPanic("failed to get role", zap.Error(err))
		return false
	}
	if role == "" {
		s.l.Debug("no role",
			zap.String("mapId", req.MapId),
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
		s.l.Info("unknown action", zap.String("action", string(action)))
		return false
	}
}

func (s *impl) CheckOpen(ctx context.Context, req AuthzRequest) (*OpenAuthz, error) {
	role, err := s.getRole(ctx, req)
	if err != nil {
		return nil, err
	} else if role == "" {
		var exists bool
		err := s.pg.QueryRow(ctx,
			`SELECT EXISTS(
				SELECT 1 FROM maps
					WHERE external_id = $1 AND deleted_at IS NULL)`,
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

func (s *impl) getRole(ctx context.Context, req AuthzRequest) (Role, error) {
	if req.MapId == "" {
		return "", errors.New("mapId is required")
	}

	generalRole, err := s.getGeneralAccessRole(ctx, req.MapId)
	if err != nil {
		return "", err
	}

	var userRole Role
	if req.UserId != uuid.Nil {
		if userRole, err = s.getUserAccessRole(ctx, req.MapId, req.UserId); err != nil {
			return "", err
		}
	}

	return roleMax(generalRole, userRole), nil
}

func (s *impl) getGeneralAccessRole(ctx context.Context, mapId string) (Role, error) {
	if mapId == "" {
		return "", errors.New("mapId is required")
	}
	var role Role
	err := s.pg.QueryRow(ctx,
		`SELECT general_access_role FROM maps
				WHERE external_id = $1
					AND general_access_level = 'public'
					AND deleted_at IS NULL`,
		mapId,
	).Scan(&role)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", nil
		} else {
			return "", err
		}
	}
	return role, nil
}

func (s *impl) getUserAccessRole(ctx context.Context, mapId string, userId uuid.UUID) (Role, error) {
	if mapId == "" {
		return "", errors.New("mapId is required")
	}
	if userId == uuid.Nil {
		return "", errors.New("userId is required")
	}
	var role Role
	err := s.pg.QueryRow(ctx,
		`SELECT map_roles.my_role FROM map_roles
				INNER JOIN maps ON maps.internal_id = map_roles.map_id
				WHERE maps.external_id = $1 AND map_roles.user_id = $2
					AND maps.deleted_at IS NULL`,
		mapId, userId,
	).Scan(&role)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", nil
		} else {
			return "", err
		}
	}
	return role, nil
}

func (s *impl) Access(ctx context.Context, mapId string) (*Access, error) {
	out := &Access{
		MapId:          mapId,
		UserAccess:     make([]UserAccessEntry, 0),
		PendingInvites: make([]PendingInvite, 0),
	}

	var internalId int64
	var deletedAt null.Time
	err := s.pg.QueryRow(ctx,
		`SELECT internal_id, deleted_at, general_access_level, general_access_role FROM maps
			WHERE external_id = $1`,
		mapId,
	).Scan(&internalId, &deletedAt, &out.GeneralAccessLevel, &out.GeneralAccessRole)
	if err != nil {
		return nil, err
	}
	if deletedAt.Valid {
		return nil, ErrMapNotFound
	}

	roles, err := s.listRoles(ctx, mapId)
	if err != nil {
		return nil, err
	}

	roleUsersIds := make([]uuid.UUID, 0)
	for _, role := range roles {
		roleUsersIds = append(roleUsersIds, role.userId)
	}
	roleUsers, err := s.users.GetEach(ctx, roleUsersIds)
	if err != nil {
		return nil, err
	}

	for _, roleEntry := range roles {
		user := roleUsers[roleEntry.userId]
		if roleEntry.userId != user.Id {
			s.l.Panic("roleEntry.userId != user.Id")
		}
		if roleEntry.role == RoleOwner {
			if out.Owner != nil {
				s.l.Panic("multiple owners")
			}
			out.Owner = &user
		} else {
			out.UserAccess = append(out.UserAccess, UserAccessEntry{
				User: user,
				Role: roleEntry.role,
			})
		}
	}

	rows, err := s.pg.Query(ctx,
		`SELECT email, my_role FROM pending_map_invites
					WHERE map_id = $1
					ORDER BY created_at`,
		internalId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		invite := PendingInvite{}
		err := rows.Scan(&invite.Email, &invite.Role)
		if err != nil {
			return nil, err
		}
		out.PendingInvites = append(out.PendingInvites, invite)
	}

	return out, nil
}

func (s *impl) PutAccess(ctx context.Context, from *types.User, req PutAccessRequest) error {
	if req.MapId == "" {
		return errors.New("mapId is required")
	}

	tx, err := s.pg.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var internalId int64
	var deletedAt null.Time
	err = tx.QueryRow(ctx, `SELECT internal_id, deleted_at FROM maps
		WHERE external_id = $1
		FOR UPDATE`, req.MapId).Scan(&internalId, &deletedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrMapNotFound
		}
		return err
	} else if deletedAt.Valid {
		return ErrMapNotFound
	}

	if req.Owner != nil {
		_, err = tx.Exec(ctx,
			`DELETE FROM map_roles WHERE map_id = $1 AND my_role = 'owner'`,
			internalId)
		if err != nil {
			return err
		}

		err = grant(ctx, tx, req.MapId, *req.Owner, RoleOwner)
		if err != nil {
			return err
		}
	}

	if req.GeneralAccessLevel != "" {
		_, err = tx.Exec(ctx,
			`UPDATE maps SET general_access_level = $2
				WHERE external_id = $1`,
			req.MapId, req.GeneralAccessLevel)
		if err != nil {
			return err
		}
	}

	if req.GeneralAccessRole != "" {
		_, err = tx.Exec(ctx,
			`UPDATE maps SET general_access_role = $2
				WHERE external_id = $1`,
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
				internalId, userId)
			if err != nil {
				return err
			}
		} else {
			if entry.Role == "" {
				return errors.New("role is required")
			} else if entry.Role == RoleOwner {
				return errors.New("cannot set to owner via user access")
			}
			err = grant(ctx, tx, req.MapId, userId, entry.Role)
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
		meta, err := s.Get(ctx, req.MapId)
		if err != nil {
			return err
		}

		for _, invite := range req.Invite {
			invite.MapId = req.MapId
			err := s.invite(ctx, from, meta, invite)
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

func (s *impl) listRoles(ctx context.Context, mapId string) ([]roleEntry, error) {
	rows, err := s.pg.Query(ctx,
		`SELECT user_id, my_role FROM map_roles
					JOIN maps on map_roles.map_id = maps.internal_id
					WHERE maps.external_id = $1
					ORDER BY map_roles.created_at`,
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

func (s *impl) RequestAccess(ctx context.Context, req RequestAccessRequest) error {
	if req.RequestedRole != RoleViewer && req.RequestedRole != RoleEditor {
		return errors.New("invalid requested role")
	}

	meta, err := s.q.GetMapByExternalId(ctx, req.MapId)
	if err != nil {
		return fmt.Errorf("failed to get map: %w", err)
	}

	from, err := s.users.Get(ctx, req.RequestingUser)
	if err != nil {
		return fmt.Errorf("failed to get requesting user: %w", err)
	}

	access, err := s.Access(ctx, req.MapId)
	if err != nil {
		return fmt.Errorf("failed to get access: %w", err)
	}

	for _, userAccess := range access.UserAccess {
		if userAccess.User.Id == from.Id && roleCmp(userAccess.Role, req.RequestedRole) >= 0 {
			s.l.Info("already has access", zap.String("mapId", req.MapId))
			return nil
		}
	}
	for _, invite := range access.PendingInvites {
		if invite.Email == from.Email && roleCmp(invite.Role, req.RequestedRole) >= 0 {
			s.l.Info("already has pending invite", zap.String("mapId", req.MapId))
			return nil
		}
	}

	row, err := s.q.CreateAccessRequest(ctx, queries.CreateAccessRequestParams{
		ExternalID:       ulid.Make().String(),
		RequestingUserID: pgtype.UUID{Bytes: from.Id, Valid: true},
		RecipientUserID:  pgtype.UUID{Bytes: access.Owner.Id, Valid: true},
		MapInternalID:    meta.InternalID,
		RequestedRole:    queries.PtMyRole(req.RequestedRole),
		Message:          req.Message,
	})
	if err != nil {
		return err
	}

	err = s.mailer.SendRequestAccess(mailer.RequestAccessRequest{
		RequestId:     row.ExternalID,
		From:          *from,
		To:            *access.Owner,
		Map:           metaFromQuery(meta),
		RequestedRole: string(req.RequestedRole),
		Message:       req.Message,
	})
	if err != nil {
		return err
	}

	s.l.Info("sent request access", zap.String("mapId", req.MapId))

	return nil
}

func (s *impl) ListPendingAccessRequestsToRecipient(ctx context.Context, recipientId uuid.UUID) ([]PendingAccessRequest, error) {
	rows, err := s.q.ListPendingAccessRequestsToRecipient(ctx, pgtype.UUID{Bytes: recipientId, Valid: true})
	if err != nil {
		return nil, err
	}

	out := make([]PendingAccessRequest, 0, len(rows))
	for _, row := range rows {
		out = append(out, PendingAccessRequest{
			Id:                     row.ExternalID,
			CreatedAt:              row.CreatedAt.Time,
			RequestingUserEmail:    row.RequestingUserEmail,
			RequestingUserFullName: row.RequestingUserFullName,
			MapId:                  row.MapExternalID,
			MapName:                row.MapName,
			RequestedRole:          Role(row.RequestedRole),
			Message:                row.Message,
		})
	}

	return out, nil
}

func (s *impl) ApproveAccessRequestIfAuthorized(ctx context.Context, approvingUser *types.User, id string) (err error) {
	var tx pgx.Tx
	if tx, err = s.pg.Begin(ctx); err != nil {
		return
	}
	defer func() {
		if err != nil {
			tx.Rollback(ctx)
		}
	}()
	q := s.q.WithTx(tx)

	var req queries.GetAccessRequestByExternalIdRow
	if req, err = q.GetAccessRequestByExternalId(ctx, id); err != nil {
		return
	}
	var requestingUser uuid.UUID
	if requestingUser, err = uuid.FromBytes(req.RequestingUserID.Bytes[:]); err != nil {
		return
	}
	requestedRole := Role(req.RequestedRole)

	if !s.IsAuthorized(ctx, AuthzRequest{UserId: approvingUser.Id, MapId: req.MapExternalID}, ActionShare) {
		return errors.New("not authorized to approve access request")
	}

	if err = q.MarkAccessRequestApproved(ctx, id); err != nil {
		return
	}
	if err = grant(ctx, tx, req.MapExternalID, requestingUser, requestedRole); err != nil {
		return
	}

	return tx.Commit(ctx)
}

func (s *impl) RejectAccessRequestIfAuthorized(ctx context.Context, rejectingUser *types.User, id string) (err error) {
	var req queries.GetAccessRequestByExternalIdRow
	if req, err = s.q.GetAccessRequestByExternalId(ctx, id); err != nil {
		return
	}
	if !s.IsAuthorized(ctx, AuthzRequest{UserId: rejectingUser.Id, MapId: req.MapExternalID}, ActionShare) {
		return errors.New("not authorized to reject access request")
	}

	return s.q.MarkAccessRequestRejected(ctx, id)
}

func (s *impl) Invite(ctx context.Context, from *types.User, req InviteRequest) error {
	meta, err := s.Get(ctx, req.MapId)
	if err != nil {
		return err
	}
	return s.invite(ctx, from, meta, req)
}

func (s *impl) invite(
	ctx context.Context,
	from *types.User,
	meta types.MapMeta,
	req InviteRequest,
) error {
	if err := req.Validate(); err != nil {
		s.l.Info("invalid invite request", zap.Error(err))
		return err
	}

	var deletedAt null.Time
	err := s.pg.QueryRow(ctx, `SELECT deleted_at FROM maps
		WHERE external_id = $1`, req.MapId).Scan(&deletedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrMapNotFound
		}
		return err
	} else if deletedAt.Valid {
		return ErrMapNotFound
	}

	to, err := s.users.GetByEmail(ctx, req.Email)
	if err != nil && !errors.Is(err, users.ErrNotFound) {
		return err
	}

	if errors.Is(err, users.ErrNotFound) {
		s.l.Info("inviting new user to map",
			zap.String("mapId", req.MapId))

		// Always notify new users
		err := s.mailer.SendInvite(mailer.InviteRequest{
			From:    from,
			ToEmail: req.Email,
			Map:     &meta,
			Message: req.NotifyMessage,
		})
		if err != nil {
			return err
		}

		var internalId int64
		err = s.pg.QueryRow(ctx, `SELECT internal_id FROM maps WHERE external_id = $1`, req.MapId).Scan(&internalId)
		if err != nil {
			return err
		}

		_, err = s.pg.Exec(ctx,
			`INSERT INTO pending_map_invites (map_id, email, my_role)
				VALUES ($1, $2, $3)
				ON CONFLICT (map_id, email)
					DO UPDATE SET my_role = $3`,
			internalId, req.Email, req.Role)
		if err != nil {
			return err
		}

		return nil
	} else {
		s.l.Info("inviting existing user to map",
			zap.String("mapId", req.MapId))

		err := grant(ctx, s.pg, req.MapId, to.Id, req.Role)
		if err != nil {
			return err
		}

		if req.Notify {
			err := s.mailer.SendShareNotification(mailer.ShareNotificationRequest{
				From:    from,
				To:      to,
				Map:     &meta,
				Message: req.NotifyMessage,
			})
			if err != nil {
				return err
			}
		}
		return nil
	}
}

func grant(
	ctx context.Context, db db.Querier,
	mapId string, userId uuid.UUID, role Role,
) error {
	var internalId int64
	err := db.QueryRow(ctx, `SELECT internal_id FROM maps WHERE external_id = $1`, mapId).Scan(&internalId)
	if err != nil {
		return err
	}

	_, err = db.Exec(ctx,
		`INSERT INTO map_roles (map_id, user_id, my_role)
			VALUES ($1, $2, $3)
			ON CONFLICT (map_id, user_id)
				DO UPDATE SET my_role = $3`,
		internalId, userId, role,
	)
	if err != nil {
		return err
	}

	q := queries.New(db)
	err = q.MarkAccessRequestImplicitlyObsoleted(ctx, queries.MarkAccessRequestImplicitlyObsoletedParams{
		RequestingUserID: pgtype.UUID{Bytes: userId, Valid: true},
		MapInternalID:    internalId,
	})
	if err != nil {
		return err
	}

	return nil
}

func metaFromQuery(query queries.PtMap) types.MapMeta {
	return types.MapMeta{
		Id:        query.ExternalID,
		Name:      query.Name,
		CreatedAt: query.CreatedAt.Time,
	}
}
