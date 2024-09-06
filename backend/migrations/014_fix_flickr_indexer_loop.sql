ALTER TABLE flickr_index_progress
    ADD COLUMN page integer;
DELETE
FROM flickr_index_progress;

---- create above / drop below ----

ALTER TABLE flickr_index_progress
    DROP COLUMN page;
DELETE
FROM flickr_index_progress;
