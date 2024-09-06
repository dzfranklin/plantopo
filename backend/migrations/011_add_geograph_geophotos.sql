INSERT INTO geophotos_licenses (id, name, url) VALUES
    (11, 'Attribution-ShareAlike 2.5', 'http://creativecommons.org/licenses/by-sa/2.5/');

ALTER TABLE geograph_index_progress DROP COLUMN latest;
ALTER TABLE geograph_index_progress ADD COLUMN cutoff int;

---- create above / drop below ----

DELETE FROM geophotos_licenses WHERE id = 11;

ALTER TABLE geograph_index_progress DROP COLUMN cutoff;
ALTER TABLE geograph_index_progress ADD COLUMN latest timestamptz;
