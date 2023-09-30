CREATE EXTENSION IF NOT EXISTS "citext";

CREATE TABLE
  pt.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    email CITEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    hashed_password TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
    confirmed_at TIMESTAMPTZ
  );

CREATE TABLE
  pt.email_confirmation_tokens (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID REFERENCES pt.users (id) ON DELETE CASCADE,
    token TEXT NOT NULL DEFAULT gen_random_uuid (),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
    used_at TIMESTAMPTZ
  );

CREATE UNIQUE INDEX email_confirmation_tokens_token_idx ON pt.email_confirmation_tokens (token);

CREATE TABLE
  pt.password_reset_tokens (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID REFERENCES pt.users (id) ON DELETE CASCADE,
    token TEXT NOT NULL DEFAULT gen_random_uuid (),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
    used_at TIMESTAMPTZ
  );

CREATE UNIQUE INDEX password_reset_tokens_token_idx ON pt.password_reset_tokens (token);
