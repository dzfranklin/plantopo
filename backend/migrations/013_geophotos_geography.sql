DROP INDEX geophotos_point_idx;
DROP INDEX geophotos_point_3857_idx;

ALTER TABLE geophotos
    ALTER COLUMN point
        TYPE Geography(Point, 4326)
        USING point::Geography(POINT);

CREATE INDEX geophotos_point_idx ON geophotos USING GIST (point);
CREATE INDEX geophotos_point_web_mercator_idx ON geophotos USING GIST (ST_Transform(point::geometry, 3857));

---- create above / drop below ----

DROP INDEX geophotos_point_idx;

ALTER TABLE geophotos
    ALTER COLUMN point
        TYPE Geometry(Point, 4326)
        USING point::Geometry(POINT);

CREATE INDEX geophotos_point_idx ON geophotos USING GIST (point);
