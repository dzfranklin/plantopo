-- name: SelectAllBoolFlags :many
SELECT *
FROM boolean_flags;

-- name: UpsertBoolFlag :exec
INSERT INTO boolean_flags (key, value)
VALUES ($1, $2)
ON CONFLICT (key) DO UPDATE SET value = $2;

-- name: DeleteBoolFlag :exec
DELETE
FROM boolean_flags
WHERE key = $1;
