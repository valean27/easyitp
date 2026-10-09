-- Sincronizarea modificarilor facute fara internet (coada din aplicatie):
-- edit_version = versiunea programarii, crescuta la fiecare schimbare facuta de oameni (manager, inspector, client),
-- ca o modificare facuta offline pe o versiune veche sa nu o suprascrie pe cea noua (null = 0, programari vechi);
-- client_ref = codul generat pe telefon pentru o programare / un ITP creat offline: retrimis, nu se dubleaza;
-- overlap = programare venita din coada care s-a suprapus cu altele (de exemplu una facuta online intre timp).
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS edit_version integer;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS client_ref character varying(40);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS overlap boolean;
CREATE UNIQUE INDEX IF NOT EXISTS uk_appointments_client_ref ON appointments (user_id, client_ref);

ALTER TABLE itp_records ADD COLUMN IF NOT EXISTS client_ref character varying(40);
CREATE UNIQUE INDEX IF NOT EXISTS uk_itp_records_client_ref ON itp_records (client_ref);
