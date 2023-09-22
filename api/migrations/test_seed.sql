INSERT INTO
  users (
    id,
    email,
    full_name,
    hashed_password,
    created_at,
    confirmed_at
  )
VALUES
  (
    'dddddddd-dddd-dddd-dddd-000000000001',
    'bob@test.plantopo.com',
    'Bob Doe',
    '$2a$10$LMnYdddL3Vat3uNoKubsOefMtNBDcGvpq459V8fFQaM/.tWzm/GuC',
    '2023-09-12T11:05:04Z',
    '2023-09-12T11:50:19Z'
  ),
  (
    'dddddddd-dddd-dddd-dddd-000000000002',
    'alice@test.plantopo.com',
    'Alice Doe',
    '$2a$10$LMnYdddL3Vat3uNoKubsOefMtNBDcGvpq459V8fFQaM/.tWzm/GuC',
    '2023-09-20T19:24:49Z',
    null
  );
