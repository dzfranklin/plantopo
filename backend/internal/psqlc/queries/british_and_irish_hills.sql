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

-- name: SelectBritishAndIrishHill :one

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
WHERE id = $1;

-- name: ListBritishAndIrishHillPhotosOf :many

SELECT *
FROM british_and_irish_hill_photos
WHERE hill_id = ANY (@hills::int[])
ORDER BY rank DESC;

-- name: InsertBritishAndIrishHillsPhoto :exec

INSERT INTO british_and_irish_hill_photos
(hill_id, caption, licenses, source, size, width, height, uploaded_at, author, source_text, source_link, importer)
VALUES (@hill_id, @caption, @licenses, @source, @size, @width, @height,
        @uploaded_at, @author, @source_text, @source_link, @importer);

-- name: SelectOneUnreviewedBritishAndIrishHillPhoto :one

SELECT *
FROM british_and_irish_hill_photos
WHERE NOT reviewed
LIMIT 1;

-- name: ApproveBritishAndIrishHillPhoto :exec

UPDATE british_and_irish_hill_photos
SET reviewed = true
WHERE id = $1;

-- name: TrigramSearchBritishAndIrishHills :many
SELECT name, term, point, country, hill
FROM british_and_irish_hill_search_terms
ORDER BY term <-> @term
LIMIT 100;
