-- name: ImportGeophotoIfNotPresent :exec
INSERT INTO geophotos (source, source_id, index_region_id, indexed_at, attribution_text,
                       attribution_link, licenses, url, width, height,
                       small_url, small_width, small_height, point, title, date_taken)
VALUES (@source, @source_id, @index_region_id, @indexed_at, @attribution_text,
        @attribution_link, @licenses, @url, @width, @height,
        @small_url, @small_width, @small_height, st_makepoint(@lng, @lat), @title, @date_taken)
ON CONFLICT (source, source_id) DO NOTHING;

-- name: CreateFlickrIndexRegion :one
INSERT INTO flickr_index_regions (name, min_lng, min_lat, max_lng, max_lat)
VALUES (@name, @min_lng, @min_lat, @max_lng, @max_lat)
RETURNING *;

-- name: ListFlickrIndexRegions :many
SELECT *
FROM flickr_index_regions;

-- name: UpdateFlickrIndexProgress :exec
INSERT INTO flickr_index_progress (region_id, latest, page)
VALUES (@region_id, @latest, @page)
ON CONFLICT (region_id) DO UPDATE set latest = @latest,
                                      page   = @page;

-- name: GetFlickrIndexProgress :one
SELECT latest, page
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

-- name: SelectGeophotoTile :one
WITH mvtgeom AS
         (SELECT ST_AsMVTGeom(
                         ST_Transform(point::geometry, 3857),
                         ST_TileEnvelope(@z, @x, @y),
                         extent => 4096,
                         buffer => 256,
                         clip_geom => true
                 ) AS geom,
                 id
          FROM geophotos
          WHERE ST_Transform(point::geometry, 3857) && ST_TileEnvelope(@z, @x, @y, margin => (64.0 / 4096)))
SELECT ST_AsMVT(mvtgeom.*, 'default', 4096, 'geom', 'id')
FROM mvtgeom;

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
       date_taken
FROM geophotos
WHERE id = any (@ids::bigint[]);
