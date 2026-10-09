-- Setarile platformei (un singur rand, id = 1), editate de admin: facturarea abonamentelor prin FGO.
-- fgo_key = cheia privata API, criptata (AES-GCM, cheie derivata din JWT_SECRET); nu pleaca niciodata spre interfata.
CREATE TABLE platform_settings (
    id bigint PRIMARY KEY,
    fgo_cui character varying(20),
    fgo_key character varying(500),
    fgo_series character varying(20),
    fgo_test boolean,
    fgo_mark_paid boolean,
    fgo_payment_type character varying(50),
    updated_at timestamp(6) without time zone
);
