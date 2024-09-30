CREATE TABLE british_and_irish_hill_search_terms
(
    id      bigint primary key generated always as identity,
    term    text not null,
    name    text                                       not null,
    point   geometry(Point, 4326)                      not null,
    country text                                       not null,
    hill    integer references british_and_irish_hills not null
);

CREATE INDEX british_and_irish_hill_search_terms_term_trgm_gist
    ON british_and_irish_hill_search_terms USING GIST (term gist_trgm_ops);

DO
$$
    DECLARE
        rec  RECORD;
        term TEXT;
    BEGIN
        FOR rec IN SELECT * FROM british_and_irish_hills
            LOOP
                FOREACH term IN ARRAY regexp_split_to_array(rec.name, '[-\[\]()]')
                    LOOP
                        term = regexp_replace(term, ''' ', '', 'g');
                        term = regexp_replace(term, '''', '', 'g');
                        term = regexp_replace(term, '\s+', ' ', 'g');
                        term = lower(term);
                        term = trim(term);

                        IF term != '' AND term != ' ' THEN
                            INSERT INTO british_and_irish_hill_search_terms
                                (term, name, point, country, hill)
                            VALUES (term, rec.name, rec.point, rec.country, rec.id);
                        END IF;
                    END LOOP;
            END LOOP;
    END
$$;

---- create above / drop below ----

DROP TABLE british_and_irish_hill_search_terms;
