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

INSERT INTO british_and_irish_hills (id, name, point, smc_parent_id, classification, map_50k, map_25k, metres, grid_ref,
                                     grid_ref_10, drop, col_grid_ref, col_height, feature, observations, survey,
                                     country, revision, comments)
VALUES (1, 'Ben Chonzie', ST_MakePoint(-3.992057, 56.453851), null, '{Ma,M,Sim,HHB}', '51 52', 'OL47W 368W 379W', 930.4,
        'NN773308', 'NN 77326 30850', 646.9, 'NN 5609 2772', 283.4, 'cairn/shelter', null, 'Abney level/Leica RX1250',
        'S', '11-Jul-23', null)
