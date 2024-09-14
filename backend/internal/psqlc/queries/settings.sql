-- name: SelectSettings :one
SELECT *
FROM user_settings
WHERE user_id = $1;

-- name: UpsertSettings :one
INSERT INTO user_settings (user_id, value, updated_at)
VALUES (@user_id, @new_value, now())
ON CONFLICT (user_id)
    DO UPDATE SET value      = user_settings.value || @new_value,
                  updated_at = now()
RETURNING *;
