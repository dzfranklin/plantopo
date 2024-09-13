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

-- name: SelectGeophotoTileSampled :one
SELECT ST_AsMVT(tile.*, 'default', 4096, 'geom') as tile
FROM (SELECT ST_AsMVTGeom(
                     ST_Transform(center::geometry, 3857),
                     ST_TileEnvelope(@z::integer, @x::integer, @y::integer),
                     extent => 4096,
                     buffer => 256,
                     clip_geom => true
             ) AS geom,
             count
      FROM (SELECT ST_Centroid(ST_Collect(ST_Transform(point::geometry, 3857))) as center,
                   count(cluster_id) * (100 / @percent)                         as count
            FROM (SELECT ST_ClusterDBSCAN(ST_Transform(point::geometry, 3857),
                         (40075017.0 / (256 * 2 ^ @z)),
                         1) OVER () AS cluster_id,
                         point
                  FROM geophotos
                           TABLESAMPLE system (@percent)
                  WHERE ST_Transform(point::geometry, 3857) &&
                        ST_TileEnvelope(@z::integer, @x::integer, @y::integer,
                                        margin => (64.0 / 4096))) AS cluster
            GROUP BY cluster_id) AS clusters) AS tile;

-- name: SelectGeophotoTile :one
SELECT ST_AsMVT(tile.*, 'default', 4096, 'geom') as tile
FROM (SELECT ST_AsMVTGeom(
                     ST_Transform(center::geometry, 3857),
                     ST_TileEnvelope(@z::integer, @x::integer, @y::integer),
                     extent => 4096,
                     buffer => 256,
                     clip_geom => true
             ) AS geom,
             count
      FROM (SELECT ST_Centroid(ST_Collect(ST_Transform(point::geometry, 3857))) as center,
                   count(cluster_id)                                            as count
            FROM (SELECT ST_ClusterDBSCAN(ST_Transform(point::geometry, 3857),
                         (40075017.0 / (256 * 2 ^ @z)),
                         1) OVER () AS cluster_id,
                         point
                  FROM geophotos
                  WHERE ST_Transform(point::geometry, 3857) &&
                        ST_TileEnvelope(@z::integer, @x::integer, @y::integer,
                                        margin => (64.0 / 4096))) AS cluster
            GROUP BY cluster_id) AS clusters) AS tile;

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
