DROP TABLE pt.map_imports;

CREATE TABLE
    pt.map_imports
(
    internal_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    external_id     TEXT        NOT NULL,
    map_id          TEXT        NOT NULL,
    format          TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    failed_at       TIMESTAMPTZ,
    failure_message TEXT
);

CREATE UNIQUE INDEX
    map_imports_external_id_idx
    ON
        pt.map_imports (external_id);
