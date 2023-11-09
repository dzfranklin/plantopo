CREATE TABLE pt.doclog (
    map_id text NOT NULL,
    generation_start bigint NOT NULL,
    generation_end bigint NOT NULL,
    changeset bytea NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (map_id, generation_start)
);

CREATE TABLE pt.doclog_head (
    map_id text NOT NULL PRIMARY KEY ,
    generation_start bigint NOT NULL
);
