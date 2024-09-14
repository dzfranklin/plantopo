CREATE TABLE user_settings
(
    user_id    uuid primary key references users,
    value      jsonb       NOT NULL,
    updated_at timestamptz NOT NULL
);

---- create above / drop below ----

DROP TABLE user_settings;
