-- name: GetMapByExternalId :one
SELECT *
FROM pt.maps
WHERE external_id = $1;

-- name: CreateAccessRequest :one
INSERT INTO pt.access_requests
(external_id, requesting_user_id, recipient_user_id, map_internal_id, requested_role, message)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: ListPendingAccessRequestsToRecipient :many
SELECT r.external_id,
       r.created_at,
       r.requested_role,
       r.message,
       m.external_id as map_external_id,
       m.name        as map_name,
       u.email       as requesting_user_email,
       u.full_name   as requesting_user_full_name
FROM pt.access_requests as r
         JOIN pt.maps m on m.internal_id = r.map_internal_id
         JOIN pt.users u on u.id = r.requesting_user_id
WHERE r.recipient_user_id = $1
  AND r.approved_at IS NULL
  AND r.rejected_at IS NULL
  AND r.implicitly_obsoleted_at IS NULL
ORDER BY r.created_at DESC;

-- name: GetAccessRequestByExternalId :one
SELECT *, m.external_id as map_external_id
FROM pt.access_requests as r
         JOIN pt.maps m on m.internal_id = r.map_internal_id
WHERE r.external_id = $1;

-- name: MarkAccessRequestApproved :exec
UPDATE pt.access_requests
SET approved_at = NOW()
WHERE external_id = $1
  AND rejected_at IS NULL
  AND approved_at IS NULL;

-- name: MarkAccessRequestRejected :exec
UPDATE pt.access_requests
SET rejected_at = NOW()
WHERE external_id = $1
  AND approved_at IS NULL
  AND rejected_at IS NULL;

-- name: MarkAccessRequestImplicitlyObsoleted :exec
UPDATE pt.access_requests
SET implicitly_obsoleted_at = NOW()
WHERE requesting_user_id = $1
  AND map_internal_id = $2
  AND implicitly_obsoleted_at IS NULL;
