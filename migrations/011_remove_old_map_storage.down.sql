CREATE TABLE
    pt.map_snapshots
(
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    map_id     BIGSERIAL   NOT NULL REFERENCES pt.maps (internal_id) ON DELETE CASCADE,
    value      BYTEA       NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
