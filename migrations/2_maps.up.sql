CREATE TYPE my_role AS ENUM ('owner', 'editor', 'viewer');
CREATE TYPE general_access_level as ENUM ('restricted', 'public');
CREATE TYPE general_access_role as ENUM ('viewer', 'editor');

CREATE TABLE maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_deleted BOOLEAN DEFAULT FALSE,
  general_access_level general_access_level NOT NULL DEFAULT 'restricted',
  general_access_role general_access_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE map_roles (
  id SERIAL PRIMARY KEY,
  map_id UUID NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  my_role my_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX map_roles_user_map_idx ON map_roles (user_id, map_id);

CREATE TABLE pending_map_invites (
  id SERIAL PRIMARY KEY,
  map_id UUID NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  my_role my_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
