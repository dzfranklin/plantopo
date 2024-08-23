-- name: ListBritishAndIrishHills :many

SELECT id,
       ST_X(point) as lng,
       ST_Y(point) as lat,
       name,
       smc_parent_id,
       classification,
       map_50k,
       map_25k,
       metres,
       grid_ref,
       grid_ref_10,
       drop,
       col_grid_ref,
       col_height,
       feature,
       observations,
       survey,
       country,
       revision,
       comments
FROM british_and_irish_hills
WHERE CASE
          WHEN @classification_contains_specified::boolean THEN classification @> @classification_contains
          ELSE true END
ORDER BY id;

-- name: ListBritishAndIrishHillPhotosOf :many

SELECT *
FROM british_and_irish_hill_photos
WHERE hill_id = ANY (@hills::int[]);

-- name: InsertBritishAndIrishHillsPhoto :exec

INSERT INTO british_and_irish_hill_photos
(hill_id, caption, licenses, source, size, width, height, uploaded_at, author, source_text, source_link, importer)
VALUES (@hill_id, @caption, @licenses, @source, @size, @width, @height,
        @uploaded_at, @author, @source_text, @source_link, @importer);
