
INSERT INTO users (id, name, email, email_confirmed, created_at, password_hash)
VALUES ('0190aac7-147b-76b2-9f5c-4bb563c1d7ce', -- u_068anhrmfdvb57tw9etp7geqsr
        'Daniel Franklin (dev)',
        'daniel@danielzfranklin.org',
        true,
        '2024-01-01T23:24:25',
        '$2a$12$nM6Pzmn56EbHN46bt/X07OCAuEarpHglVSIP4gIEyMPd67PxWjmzu' -- password
       );

INSERT INTO admins (user_id)
VALUES ('0190aac7-147b-76b2-9f5c-4bb563c1d7ce');

INSERT INTO users (id, name, email, email_confirmed, created_at, password_hash)
VALUES ('0190ab77-f1d8-7737-8365-d61bd0e0e811', -- u_068apxzhv1vkf0v5trdx1r7824
        'Test User',
        'test@example.com',
        true,
        '2024-01-01T23:24:25',
        '$2a$12$nM6Pzmn56EbHN46bt/X07OCAuEarpHglVSIP4gIEyMPd67PxWjmzu' -- password
       );
