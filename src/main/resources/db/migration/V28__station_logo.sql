-- Logo-ul statiei (pagina de programare, emailurile catre clienti, lista de statii). Imaginea sta separat, ca sa nu
-- se incarce odata cu contul la fiecare cerere; logo_token se schimba la fiecare logo nou (linkul poate fi tinut in cache).
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS logo_token character varying(40);
-- Mesajul statiei pe pagina de programare (ex. "Veniți cu 10 minute înainte")
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS booking_message character varying(300);

CREATE TABLE station_logos (
    user_id bigint PRIMARY KEY REFERENCES app_users (id),
    image bytea NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);
