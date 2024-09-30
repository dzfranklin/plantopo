-- name: SearchGBPostcodeBiased :many
SELECT code, point
FROM gb_postcode_points
WHERE code_normalized LIKE @normalized_prefix||'%'
ORDER BY point <-> ST_SetSrid(ST_MakePoint(@bias_lng, @bias_lat), 4326), code
LIMIT 10;

-- name: SearchGBPostcode :many
SELECT code, point
FROM gb_postcode_points
WHERE code_normalized LIKE @normalized_prefix||'%'
ORDER BY code
LIMIT 10;

-- name: SelectGBPostcodePoint :one
SELECT code, point FROM gb_postcode_points WHERE code = $1;

-- name: BulkInsertGBPostcodePoints :copyfrom
INSERT INTO gb_postcode_points (code, point) VALUES ($1, $2);

-- name: DeleteAllDBPostcodePoints :exec
DELETE FROM gb_postcode_points;
