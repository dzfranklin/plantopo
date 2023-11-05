ALTER TABLE pt.users
    ALTER COLUMN hashed_password TYPE text USING convert_from(hashed_password, 'LATIN1');
