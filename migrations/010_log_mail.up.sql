CREATE TABLE pt.mailgun_log
(
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT now(),
    "to"          TEXT NOT NULL,
    subject     TEXT NOT NULL,
    text_body   TEXT NOT NULL,
    send_status TEXT NOT NULL,
    send_id     TEXT NOT NULL
);
