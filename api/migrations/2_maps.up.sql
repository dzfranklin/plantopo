CREATE TYPE my_role AS ENUM ('owner', 'editor', 'viewer');

CREATE TYPE general_access_level as ENUM ('restricted', 'public');

CREATE TYPE general_access_role as ENUM ('viewer', 'editor');

CREATE TABLE
  maps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    name TEXT NOT NULL DEFAULT '',
    general_access_level general_access_level NOT NULL DEFAULT 'restricted',
    general_access_role general_access_role NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
    deleted_at TIMESTAMPTZ
  );

CREATE TABLE
  map_roles (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    map_id UUID NOT NULL REFERENCES maps (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    my_role my_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
  );

CREATE UNIQUE INDEX map_roles_user_map_idx ON map_roles (user_id, map_id);

CREATE TABLE
  pending_map_invites (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    map_id UUID NOT NULL REFERENCES maps (id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    my_role my_role NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
  );

CREATE UNIQUE INDEX pending_map_invites_map_id_email_idx ON pending_map_invites (map_id, email);

CREATE TABLE
  map_snapshots (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    map_id UUID NOT NULL REFERENCES maps (id) ON DELETE CASCADE,
    value BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
  );

CREATE UNIQUE INDEX map_snapshots_map_id_idx ON map_snapshots (map_id);