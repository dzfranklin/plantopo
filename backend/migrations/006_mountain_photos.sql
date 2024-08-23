CREATE TABLE british_and_irish_hill_photos
(
    id          bigserial primary key,
    hill_id     int REFERENCES british_and_irish_hills NOT NULL,
    caption     text,
    licenses    text[],
    source      text                                   NOT NULL,
    size        int                                    NOT NULL,
    width       int                                    NOT NULL,
    height      int                                    NOT NULL,
    uploaded_at timestamp,
    author      text,
    source_text text,
    source_link text,
    importer    text
);

---- create above / drop below ----

DROP TABLE british_and_irish_hill_photos;
