ALTER TABLE flickr_index_progress
    DROP COLUMN page;

---- create above / drop below ----

ALTER TABLE flickr_index_progress
    ADD COLUMN page integer;
