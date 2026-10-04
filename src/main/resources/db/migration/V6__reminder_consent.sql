-- Acordul clientului pentru remindere (GDPR): GIVEN = a fost de acord, DECLINED = nu doreste mesaje
-- (link STOP sau marcat de statie), NULL = necunoscut (clientii de dinainte). opt_out_token = link-ul STOP personal.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS reminder_consent character varying(20);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS consent_at timestamp(6) without time zone;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS consent_source character varying(40);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS opt_out_token character varying(40);
UPDATE clients SET opt_out_token = SUBSTRING(MD5(RANDOM()::text || id::text || CLOCK_TIMESTAMP()::text) FOR 24)
WHERE opt_out_token IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_opt_out_token ON clients (opt_out_token);

-- Bifa de acord din programarea online; trece la client cand se face ITP-ul din programare
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_consent boolean;
