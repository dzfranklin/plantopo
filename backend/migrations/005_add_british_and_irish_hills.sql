-- See <https://www.hills-database.co.uk/database_notes.html#fields> and ./cmd/import_dobih

CREATE TABLE british_and_irish_hills
(
    id             int PRIMARY KEY,
    name           text,
    point          geometry(Point, 4326),
    smc_parent_id  int references british_and_irish_hills,
    classification text[],
    map_50k        text,
    map_25k        text,
    metres         double precision,
    grid_ref       text,
    grid_ref_10    text,
    drop           double precision,
    col_grid_ref   text,
    col_height     double precision,
    feature        text,
    observations   text,
    survey         text,
    country        text,
    revision       text,
    comments       text
);

CREATE INDEX british_and_irish_hills_classification_idx ON british_and_irish_hills USING GIN (classification);

---- create above / drop below ----

-- Write your migrate down statements here. If this migration is irreversible
-- Then delete the separator line above.

DROP INDEX british_and_irish_hills_classification_idx;

DROP TABLE british_and_irish_hills;
