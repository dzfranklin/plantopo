ALTER TABLE british_and_irish_hill_photos
    ADD COLUMN rank integer NOT NULL DEFAULT 0;

---- create above / drop below ----

ALTER TABLE british_and_irish_hill_photos
    DROP COLUMN rank;
