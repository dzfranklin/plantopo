CREATE TABLE geophotos_sources
(
    id   integer primary key,
    name text
);

INSERT INTO geophotos_sources (id, name)
VALUES (1, 'flickr'),
       (2, 'geograph');

CREATE TABLE geophotos_licenses
(
    id   integer primary key,
    name text not null,
    url  text
);

-- Match flickr IDs
INSERT INTO geophotos_licenses (id, name, url)
VALUES (0, 'All Rights Reserved', null),
       (4, 'Attribution License', 'https://creativecommons.org/licenses/by/2.0/'),
       (6, 'Attribution-NoDerivs License', 'https://creativecommons.org/licenses/by-nd/2.0/'),
       (3, 'Attribution-NonCommercial-NoDerivs License', 'https://creativecommons.org/licenses/by-nc-nd/2.0/'),
       (2, 'Attribution-NonCommercial License', 'https://creativecommons.org/licenses/by-nc/2.0/'),
       (1, 'Attribution-NonCommercial-ShareAlike License', 'https://creativecommons.org/licenses/by-nc-sa/2.0/'),
       (5, 'Attribution-ShareAlike License', 'https://creativecommons.org/licenses/by-sa/2.0/'),
       (7, 'Flickr Commons', 'https://www.flickr.com/commons/usage/'),
       (8, 'United States Government Work', 'http://www.usa.gov/copyright.shtml'),
       (9, 'Public Domain Dedication (CC0)', 'https://creativecommons.org/publicdomain/zero/1.0/'),
       (10, 'Public Domain Mark', 'https://creativecommons.org/publicdomain/mark/1.0/');

CREATE TABLE geophotos
(
    id               bigserial primary key,
    source           integer references geophotos_sources,
    source_id        text,
    index_region_id  integer,
    indexed_at       timestamptz,
    attribution_text text,
    attribution_link text,
    licenses         integer[],
    url              text    NOT NULL,
    width            integer NOT NULL,
    height           integer NOT NULL,
    small_url        text,
    small_width      integer,
    small_height     integer,
    point            geometry(Point, 4326),
    title            text,
    date_taken       timestamptz
);

CREATE INDEX geophotos_point_idx ON geophotos USING GIST (point);
CREATE UNIQUE INDEX geophotos_source_source_id_uniq ON geophotos (source, source_id);

CREATE TABLE flickr_index_regions
(
    id      serial primary key,
    name    text             NOT NULL,
    min_lng double precision NOT NULL,
    min_lat double precision NOT NULL,
    max_lng double precision NOT NULL,
    max_lat double precision NOT NULL
);

-- generated by drawing boxes on https://geojson.io and then using https://turf-sandbox.netlify.app/ `console.log(fc.features.map((f, i) => `('${prefix}${i+1}', ${turf.bbox(f).map(n => n.toFixed(6)).join(', ')})`).join(",\n"))`

INSERT INTO flickr_index_regions (name, min_lng, min_lat, max_lng, max_lat)
VALUES
    -- Highlands & Islands
    ('sct_highlands_1', -7.682294, 56.876307, -2.355369, 57.178269),
    ('sct_highlands_2', -6.564913, 56.675067, -2.915769, 56.876791),
    ('sct_highlands_3', -7.016359, 56.520860, -3.501917, 56.677065),
    ('sct_highlands_4', -6.565064, 56.085681, -4.383614, 56.253328),
    ('sct_highlands_5', -6.579002, 55.924972, -4.579292, 56.089581),
    ('sct_highlands_6', -6.667367, 55.283026, -4.909857, 55.925612),
    ('sct_highlands_7', -7.018109, 56.251179, -3.667790, 56.523271),
    ('sct_highlands_8', -7.683739, 57.177986, -2.732372, 57.410691),
    ('sct_highlands_9', -8.299363, 57.732347, -0.193797, 60.961018),
    ('sct_highlands_10', -7.685177, 57.408544, -4.360680, 57.731466);

CREATE TABLE flickr_index_progress
(
    region_id integer primary key references flickr_index_regions (id),
    latest    timestamptz NOT NULL
);

CREATE TABLE geograph_index_progress
(
    id     integer primary key, -- always 0
    latest timestamptz NOT NULL
);

INSERT INTO geograph_index_progress (id, latest)
VALUES (0, to_timestamp(0));

---- create above / drop below ----

DROP TABLE geophotos;
DROP TABLE geophotos_sources;
DROP TABLE geophotos_licenses;
DROP TABLE flickr_index_progress;
DROP TABLE flickr_index_regions;
DROP TABLE geograph_index_progress;