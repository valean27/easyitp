-- C3: programari fara neprezentari
-- manage_token = link-ul clientului pentru anulare/mutare (/p/{token}); client_action = ce a facut clientul din link
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS manage_token character varying(40);
UPDATE appointments SET manage_token = SUBSTRING(MD5(RANDOM()::text || id::text || CLOCK_TIMESTAMP()::text) FOR 16)
WHERE manage_token IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_manage_token ON appointments (manage_token);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamp(6) without time zone;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent_at timestamp(6) without time zone;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS client_action character varying(20);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS client_action_at timestamp(6) without time zone;

-- SMS-uri pentru programari, pe canalul SMS al statiei: confirmare la programarea online si reminder cu o zi inainte
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS appt_confirm_sms boolean;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS appt_reminder_sms boolean;
