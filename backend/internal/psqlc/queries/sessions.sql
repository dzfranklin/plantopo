-- name: InsertSession :one
INSERT INTO sessions (user_id, user_agent, ip_addr)
VALUES (@user_id, @user_agent, @ip_addr)
RETURNING token;

-- name: RefreshSessionExpiry :exec
UPDATE sessions
SET expiry_start = now()
WHERE token = @token;

-- name: DeleteSession :one
DELETE
FROM sessions
WHERE token = @token
RETURNING user_id;

-- name: GetSession :one
SELECT *
FROM sessions
WHERE token = @token;

-- name: ListSessionsByUser :many
SELECT *
FROM sessions
WHERE user_id = @user_id;
