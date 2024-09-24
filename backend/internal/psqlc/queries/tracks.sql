-- name: InsertTrack :one
INSERT INTO tracks (owner_id, name, description_md, date, date_uploaded, times, line)
VALUES (@owner_id, @name, @description_md, @date, now(),
        @times, @line)
RETURNING *;

-- name: UpdateTrack :one
UPDATE tracks
SET name           = @name,
    description_md = @description_md,
    date           = @date,
    times          = @times,
    line           = @line
WHERE id = @id
RETURNING *;

-- name: SelectTrack :one
SELECT *
FROM tracks
WHERE id = @id;

-- name: DeleteTrack :exec
DELETE
FROM tracks
WHERE id = @id;

-- name: SearchTracks :many
SELECT *
FROM tracks
WHERE owner_id = @owner_id
ORDER BY CASE WHEN @order_by_name THEN name END,
         CASE WHEN @order_by_date_asc THEN date END,
         CASE WHEN @order_by_date_desc THEN date END desc,
         CASE WHEN @order_by_date_uploaded_asc THEN date_uploaded END,
         CASE WHEN @order_by_date_uploaded_desc THEN date_uploaded END desc
OFFSET @offset_value LIMIT @limit_value;

-- name: SearchTracksTile :one
WITH mvtgeom AS
         (SELECT ST_AsMVTGeom(
                         ST_Transform(line::geometry, 3857),
                         ST_TileEnvelope(@z, @x, @y), extent => 4096,
                         buffer => 64
                 )                         AS geom,
                 uuid_to_id('t', id)       as id,
                 uuid_to_id('u', owner_id) as owner_id,
                 name,
                 line_feature_id
          FROM tracks
          WHERE owner_id = @owner_id
            AND ST_Transform(line::geometry, 3857) &&
                ST_TileEnvelope(@z, @x, @y, margin => (64.0 / 4096)))
SELECT ST_AsMVT(mvtgeom, 'default', 4096, 'geom', 'line_feature_id')
FROM mvtgeom;
