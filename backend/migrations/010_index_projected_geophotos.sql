-- Write your migrate up statements here

CREATE INDEX geophotos_point_3857_idx ON geophotos USING GIST (ST_Transform(point, 3857));

---- create above / drop below ----

DROP INDEX geophotos_point_3857_idx;
