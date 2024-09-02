ALTER TABLE british_and_irish_hill_photos
    ADD COLUMN reviewed boolean NOT NULL DEFAULT false;

---- create above / drop below ----

ALTER TABLE british_and_irish_hill_photos
    DROP COLUMN reviewed;
