-- name: CheckAuthorizedSMSSender :one
SELECT exists(
    SELECT 1 FROM authorized_sms_senders WHERE number_e164 = @number
);

-- name: GetAuthorizedSMSSender :one
SELECT * FROM authorized_sms_senders WHERE id = @id;

-- name: ListAllAuthorizedSMSSenders :many
SELECT * FROM authorized_sms_senders;
