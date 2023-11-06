DROP TABLE pt.map_snapshots;
DROP TABLE pt.pending_map_invites;
DROP TABLE pt.map_roles;
DROP TABLE pt.maps;

CREATE TABLE
    pt.maps (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
                name TEXT NOT NULL DEFAULT '',
                general_access_level pt.general_access_level NOT NULL DEFAULT 'restricted',
                general_access_role pt.general_access_role NOT NULL DEFAULT 'viewer',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
                deleted_at TIMESTAMPTZ
);

CREATE TABLE
    pt.map_roles (
                     id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                     map_id UUID NOT NULL REFERENCES pt.maps (id) ON DELETE CASCADE,
                     user_id UUID NOT NULL REFERENCES pt.users (id) ON DELETE CASCADE,
                     my_role pt.my_role NOT NULL,
                     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
);

CREATE UNIQUE INDEX map_roles_user_map_idx ON pt.map_roles (user_id, map_id);

CREATE TABLE
    pt.pending_map_invites (
                               id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                               map_id UUID NOT NULL REFERENCES pt.maps (id) ON DELETE CASCADE,
                               email TEXT NOT NULL,
                               my_role pt.my_role NOT NULL DEFAULT 'viewer',
                               created_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
);

CREATE UNIQUE INDEX pending_map_invites_map_id_email_idx ON pt.pending_map_invites (map_id, email);

CREATE TABLE
    pt.map_snapshots (
                         id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                         map_id UUID NOT NULL REFERENCES pt.maps (id) ON DELETE CASCADE,
                         value BYTEA NOT NULL,
                         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
);

CREATE UNIQUE INDEX map_snapshots_map_id_idx ON pt.map_snapshots (map_id);
