-- name: PushAuditLog :exec
INSERt INTO audit_log (subject, object, action, payload)
VALUES (@subject, @object, @action, @payload);

-- name: GetAuditLog :one
SELECT *
FROM audit_log
WHERE id = @id;

-- name: ListAuditLog :many
SELECT *
FROM audit_log
WHERE CASE WHEN @subject_specified::boolean THEN subject = @subject::text ELSE true END
  AND CASE WHEN @object_specified::boolean THEN object = @object::text ELSE true END
  AND CASE WHEN @action_specified::boolean THEN action = @action::text ELSE true END
  AND CASE WHEN @cursor_back::boolean THEN id < @cursor ELSE true END
  AND CASE WHEN @cursor_forward::boolean THEN id > @cursor ELSE true END
ORDER BY id DESC
LIMIT 100;

-- name: SelectMaxAuditLogID :one
SELECT coalesce(max(id), 0)
FROM audit_log;
