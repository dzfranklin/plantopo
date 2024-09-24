INSERT INTO users (id, name, email, email_confirmed, created_at, password_hash)
VALUES ('6e1938a8-6a56-42bb-8d72-bf4b3a7c79f3', -- u_drckha3aas1bq3bjqx5kmz3syc
        'Demo User',
        'demo@plantopo.com',
        true,
        '2024-01-01T23:24:25',
        '$2a$12$nM6Pzmn56EbHN46bt/X07OCAuEarpHglVSIP4gIEyMPd67PxWjmzu' -- password
       );

---- create above / drop below ----

DELETE FROM users WHERE id = '6e1938a8-6a56-42bb-8d72-bf4b3a7c79f3';
