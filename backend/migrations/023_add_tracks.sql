CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE tracks
(
    id              uuid primary key default uuid_generate_v7(),
    owner_id        uuid                        not null references users,
    name            text,
    description_md  text,
    date            timestamptz                 not null,
    date_uploaded   timestamptz                 not null,
    length_meters   double precision GENERATED ALWAYS AS ( ST_Length(line) ) STORED,
    duration_secs   integer GENERATED ALWAYS AS ( CASE
                                                      WHEN array_length(times, 1) >= 2
                                                          THEN extract('epoch' from times[array_upper(times, 1)] - times[1]) END ) STORED,
    times           timestamptz[] CHECK ( array_length(times, 1) = ST_NPoints(line::geometry) ),
    line            Geography(LineString, 4326) not null,
    line_feature_id bigserial
);

CREATE INDEX tracks_owner_id_line_3857_idx ON tracks USING GIST (owner_id, ST_Transform(line::geometry, 3857));
CREATE INDEX tracks_owner_id_idx ON tracks (owner_id);
CREATE INDEX tracks_owner_id_name_idx ON tracks (owner_id, name);
CREATE INDEX tracks_owner_id_date_idx ON tracks (owner_id, date);
CREATE INDEX tracks_owner_id_date_uploaded_idx ON tracks (owner_id, date_uploaded);

---- create above / drop below ----

DROP TABLE tracks;
