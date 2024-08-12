CREATE TABLE authorized_sms_senders
(
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
    inserted_at timestamp DEFAULT now() NOT NULL,
    -- Use https://api.plantopo.com/admin/tel-input to format as E.164
    number_e164 text NOT NULL,
    comment     text
);

CREATE UNIQUE INDEX authorized_sms_senders_number_e164_idx ON authorized_sms_senders (number_e164);

---- create above / drop below ----

DROP TABLE authorized_sms_senders;
