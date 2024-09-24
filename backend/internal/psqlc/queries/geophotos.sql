-- name: ImportGeophotoIfNotPresent :exec
INSERT INTO geophotos (source, source_id, index_region_id, indexed_at, attribution_text,
                       attribution_link, licenses, url, width, height,
                       small_url, small_width, small_height, point, title, date_uploaded, date_taken)
VALUES (@source, @source_id, @index_region_id, @indexed_at, @attribution_text,
        @attribution_link, @licenses, @url, @width, @height,
        @small_url, @small_width, @small_height, st_makepoint(@lng, @lat),
        @title, @date_uploaded, @date_taken)
ON CONFLICT (source, source_id) DO NOTHING;

-- name: CreateFlickrIndexRegion :one
INSERT INTO flickr_index_regions (name, min_lng, min_lat, max_lng, max_lat)
VALUES (@name, @min_lng, @min_lat, @max_lng, @max_lat)
RETURNING *;

-- name: ListFlickrIndexRegions :many
SELECT *
FROM flickr_index_regions;

-- name: UpdateFlickrIndexProgress :exec
INSERT INTO flickr_index_progress (region_id, latest)
VALUES (@region_id, @latest)
ON CONFLICT (region_id) DO UPDATE set latest = @latest;

-- name: GetFlickrIndexProgress :one
SELECT latest
FROM flickr_index_progress
WHERE region_id = @region_id;

-- name: UpdateGeographIndexProgress :exec
UPDATE geograph_index_progress
SET cutoff = @cutoff
WHERE id = 0;

-- name: GetGeographIndexProgress :one
SELECT cutoff
FROM geograph_index_progress
WHERE id = 0;

-- name: SelectGeophotosByID :many
SELECT id,
       source,
       source_id,
       index_region_id,
       indexed_at,
       attribution_text,
       attribution_link,
       licenses,
       url,
       width,
       height,
       small_url,
       small_width,
       small_height,
       ST_X(point::geometry) as lng,
       ST_Y(point::geometry) as lat,
       title,
       date_uploaded,
       date_taken
FROM geophotos
WHERE id = any (@ids::bigint[]);

-- name: SelectGeophotosWithin :many
SELECT id,
       source,
       source_id,
       index_region_id,
       indexed_at,
       attribution_text,
       attribution_link,
       licenses,
       url,
       width,
       height,
       small_url,
       small_width,
       small_height,
       ST_X(point::geometry) as lng,
       ST_Y(point::geometry) as lat,
       title,
       date_uploaded,
       date_taken
FROM geophotos
WHERE ST_Intersects(point, ST_MakeEnvelope(@minLng, @minLat, @maxLng, @maxLat, 4326)::geography)
LIMIT @max_rows;

-- name: SelectAllGeophotos :many
SELECT id, ST_X(point::geometry) as lng, ST_Y(point::geometry) as lat
FROM geophotos
WHERE id > @cursor
ORDER BY id
LIMIT 1000;
