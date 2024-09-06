INSERT INTO flickr_index_regions (name, min_lng, min_lat, max_lng, max_lat)
VALUES ('alaska', -170.730107, 52.224801, -141.016549, 72.091078);

---- create above / drop below ----

DELETE FROM flickr_index_regions WHERE name = 'alaska';
