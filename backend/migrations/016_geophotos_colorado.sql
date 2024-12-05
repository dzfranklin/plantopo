INSERT INTO flickr_index_regions (name, min_lng, min_lat, max_lng, max_lat)
VALUES ('colorado', -109.024750, 37.008039, -102.071179, 40.991509);

---- create above / drop below ----

DELETE
FROM flickr_index_regions
WHERE name = 'colorado';
