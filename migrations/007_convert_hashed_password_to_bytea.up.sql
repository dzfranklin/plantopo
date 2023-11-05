ALTER TABLE pt.users
    ALTER COLUMN hashed_password TYPE bytea USING convert_to(hashed_password, 'LATIN1');
