CREATE TABLE audit_log
(
    id      bigserial PRIMARY KEY,
    time    timestamp DEFAULT now(),
    subject text NOT NULL,
    object  text NOT NULL,
    action  text NOT NULL,
    payload JSONB
);

CREATE INDEX audit_log_subject_idx ON audit_log (subject, id);
CREATE INDEX audit_log_object_idx ON audit_log (object, id);
CREATE INDEX audit_log_action_idx ON audit_log (action, id);

CREATE TABLE users
(
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
    name            text,
    email           citext NOT NULL,
    email_confirmed boolean          DEFAULT false,
    password_hash   bytea,
    created_at      timestamp        default now()
);

CREATE UNIQUE INDEX users_email_uniq ON users (email);

CREATE TABLE sessions
(
    token        text      DEFAULT 'plantoposecret_' || encode(gen_random_bytes(32), 'hex') NOT NULL PRIMARY KEY,
    user_id      uuid                                                                       NOT NULL,
    created_at   timestamp default now()                                                    NOT NULL,
    expiry_start timestamp default now()                                                    NOT NULL,
    user_agent   text,
    ip_addr      inet
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);

CREATE TABLE pending_email_confirmation_tokens
(
    email      text,
    token      text      DEFAULT encode(gen_random_bytes(64), 'hex') PRIMARY KEY,
    created_at timestamp default now()
);

CREATE TABLE pending_password_reset_tokens
(
    email      text,
    token      text      DEFAULT encode(gen_random_bytes(64), 'hex') PRIMARY KEY,
    created_at timestamp default now()
);

CREATE TABLE admins
(
    user_id uuid PRIMARY KEY references users (id)
);

---- create above / drop below ----

DROP TABLE admins;
DROP TABLE pending_email_confirmation_tokens;
DROP TABLE pending_password_reset_tokens;
DROP TABLE sessions;
DROP TABLE users;
DROP TABLE audit_log;
