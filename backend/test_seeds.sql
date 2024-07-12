INSERT INTO users (id, name, email, email_confirmed, created_at, password_hash)
VALUES ('11111111-1111-1111-1111-111111111111', -- u_248h248h248h248h248h248h24
        'Test User',
        'test@example.com',
        true,
        '2024-01-01T23:24:25',
        '$2a$12$nM6Pzmn56EbHN46bt/X07OCAuEarpHglVSIP4gIEyMPd67PxWjmzu' -- password
       );

INSERT INTO users (id, name, email, email_confirmed, created_at, password_hash)
VALUES ('11111111-1111-1111-1111-111111111112', -- u_248h248h248h248h248h248h28
        'Test User 2',
        'test2@example.com',
        true,
        '2024-01-01T23:24:25',
        '$2a$12$nM6Pzmn56EbHN46bt/X07OCAuEarpHglVSIP4gIEyMPd67PxWjmzu' -- password
       );

INSERT INTO users (id, name, email, email_confirmed, created_at, password_hash)
VALUES ('0190ab3e-db71-7261-9420-c950119a9f59', -- u_068apfpve5s63510s58136mzb4
        'Admin User',
        'admin@example.com',
        true,
        '2024-01-01T23:24:25',
        '$2a$12$nM6Pzmn56EbHN46bt/X07OCAuEarpHglVSIP4gIEyMPd67PxWjmzu' -- password
       );

INSERT INTO admins (user_id) VALUES ('0190ab3e-db71-7261-9420-c950119a9f59');
