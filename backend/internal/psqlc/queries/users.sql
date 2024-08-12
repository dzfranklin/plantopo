-- name: InsertUser :one
INSERT INTO users (email, name, password_hash)
VALUES (@email, @name, @password_hash)
RETURNING *;

-- name: MarkUserEmailConfirmed :exec
UPDATE users
SET email_confirmed = true
WHERE id = @id;

-- name: SelectUser :one
SELECT *
FROM users
WHERE id = @id;

-- name: SelectUserByEmail :one
SELECT *
FROM users
WHERE email = @email::text;

-- name: ListUsers :many
SELECT *
FROM users
WHERE CASE WHEN @cursor_provided::bool THEN id < @cursor ELSE true END
ORDER BY id DESC
LIMIT 100;

-- name: CreateEmailConfirmationToken :one
INSERT INTO pending_email_confirmation_tokens (email, created_at)
VALUES (@email, @created_at)
RETURNING token;

-- name: CreatePasswordResetToken :one
INSERT INTO pending_password_reset_tokens (email, created_at)
VALUES (@email, @created_at)
RETURNING token;

-- name: SelectEmailConfirmationToken :one
SELECT *
FROM pending_email_confirmation_tokens
WHERE token = @token;

-- name: SelectPasswordResetToken :one
SELECT *
FROM pending_password_reset_tokens
WHERE token = @token;

-- name: ClearEmailConfirmationTokens :exec
DELETE
FROM pending_email_confirmation_tokens
WHERE email = @email;

-- name: ClearPendingPasswordResetTokens :exec
DELETE
FROM pending_password_reset_tokens
WHERE email = @email;

-- name: SelectIsAdmin :one
SELECT exists(SELECT 1 FROM admins WHERE user_id = @user_id);
