CREATE EXTENSION IF NOT EXISTS "citext";

CREATE TABLE
  users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    email CITEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    hashed_password TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
    confirmed_at TIMESTAMPTZ
  );

CREATE TABLE
  email_confirmation_tokens (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users (id) ON DELETE CASCADE,
    token UUID NOT NULL DEFAULT gen_random_uuid (),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
    used_at TIMESTAMPTZ
  );
