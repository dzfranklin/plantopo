ALTER TABLE geophotos
    ADD COLUMN date_uploaded timestamptz;

---- create above / drop below ----

ALTER TABLE geophotos
    DROP COLUMN date_uploaded;
