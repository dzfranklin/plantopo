CREATE TABLE gb_postcode_points (
    code text primary key,
    point Geometry(Point, 4326),
    code_normalized text generated always as ( replace(code, ' ', '') ) STORED
);

CREATE INDEX gb_postcode_points_code_normalized_pattern ON gb_postcode_points (code_normalized TEXT_PATTERN_OPS);
CREATE INDEX gb_postcode_points_point ON gb_postcode_points USING GIST (point);

---- create above / drop below ----

DROP TABLE gb_postcode_points;
