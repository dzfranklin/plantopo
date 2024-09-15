CREATE FUNCTION uuid_to_id(kind text, input uuid)
    RETURNS text
    LANGUAGE plpgsql
AS
$BODY$
DECLARE
    bytes        bytea;
    byteCount    int;
    alphabet     bytea = '0123456789abcdefghjkmnpqrstvwxyz';
    SHIFT        int   = 5; /* SHIFT is the number of bits per output character, so the length of the output is the length of the input multiplied by 8/SHIFT, rounded up.*/
    MASK         int   = 31;
    result       text  = '';
    outputLength int;
    buffer       int;
    next         int;
    bitsLeft     int;
    pad          int;
    index        int;
BEGIN
    -- Based on <https://github.com/SORMAS-Foundation/SORMAS-Project/issues/4805>

    bytes = decode(replace(input::text, '-', ''), 'hex');

    byteCount = length(bytes);
    outputLength = (byteCount * 8 + SHIFT - 1) / SHIFT;

    buffer = get_byte(bytes, 0);
    next = 1;
    bitsLeft = 8;
    while bitsLeft > 0 OR next < byteCount
        LOOP
            if (bitsLeft < SHIFT) THEN
                if (next < byteCount) THEN
                    buffer = buffer << 8;
                    buffer = buffer | (get_byte(bytes, next) & 255);
                    next = next + 1;
                    bitsLeft = bitsLeft + 8;
                ELSE
                    pad = SHIFT - bitsLeft;
                    buffer = buffer << pad;
                    bitsLeft = bitsLeft + pad;
                END IF;
            END IF;

            index = MASK & (buffer >> (bitsLeft - SHIFT));
            bitsLeft = bitsLeft - SHIFT;
            result = result || chr(get_byte(alphabet, index));
        END LOOP;
    RETURN kind || '_' || result;
END;
$BODY$;

CREATE FUNCTION id_to_uuid(kind text, input text)
    RETURNS uuid
    LANGUAGE plpgsql
AS
$BODY$
DECLARE
    alphabet  text  = '0123456789abcdefghjkmnpqrstvwxyz';
    SHIFT     int   = 5;
    result    bytea = '';
    buffer    int   = 0;
    bitsLeft  int   = 0;
    byteCount int   = 16;
    char      text;
    i         int;
    index     int;
    prefix    text;
BEGIN
    -- Extract the prefix before the underscore and verify it matches the kind
    prefix := split_part(input, '_', 1);
    IF prefix != kind THEN
        RAISE EXCEPTION 'Prefix "%" does not match the expected kind "%"', prefix, kind;
    END IF;

    -- Remove the prefix and underscore to get the encoded part
    input := split_part(input, '_', 2);

    -- Decode the input back to the byte array
    FOR i IN 1..length(input)
        LOOP
            char := substring(input, i, 1);
            index := strpos(alphabet, char) - 1;

            IF index < 0 THEN
                RAISE EXCEPTION 'Invalid character "%" in input', char;
            END IF;

            buffer := (buffer << SHIFT) | index;
            bitsLeft := bitsLeft + SHIFT;

            WHILE bitsLeft >= 8
                LOOP
                    bitsLeft := bitsLeft - 8;
                    result := result || decode(lpad(to_hex((buffer >> bitsLeft) & 255), 2, '0'), 'hex');
                END LOOP;
        END LOOP;

    -- Check if the resulting byte length is valid for a UUID
    IF length(result) != byteCount THEN
        RAISE EXCEPTION 'Invalid input length for UUID';
    END IF;

    -- Return the result as a UUID
    RETURN encode(result, 'hex')::uuid;
END;
$BODY$;

CREATE OR REPLACE FUNCTION int_to_id(kind text, input bigint)
    RETURNS text
    LANGUAGE plpgsql
AS
$BODY$
BEGIN
    return kind || '_' || input::text;
END;
$BODY$;

CREATE OR REPLACE FUNCTION id_to_int(kind text, id text)
    RETURNS bigint
    LANGUAGE plpgsql
AS
$BODY$
DECLARE
    prefix text;
    input  text;
BEGIN
    prefix := split_part(id, '_', 1);
    input := split_part(id, '_', 2);

    IF prefix != kind THEN
        RAISE EXCEPTION 'Prefix "%" does not match the expected kind "%"', prefix, kind;
    end if;

    RETURN input::bigint;
END;
$BODY$;

---- create above / drop below ----

DROP FUNCTION uuid_to_id;
DROP FUNCTION id_to_uuid;
DROP FUNCTION int_to_id;
DROP FUNCTION id_to_int;
