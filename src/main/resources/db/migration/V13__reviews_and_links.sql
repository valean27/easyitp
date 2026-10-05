-- Recenzii si vizibilitate (C5): linkurile publice ale statiei si SMS-ul cu cererea de recenzie dupa ITP
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS review_url character varying(300);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS maps_url character varying(300);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS facebook_url character varying(300);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS review_sms boolean;

-- Cand a plecat cererea de recenzie pentru acest ITP (o data pe ITP, cel mult una pe an pe client)
ALTER TABLE itp_records ADD COLUMN IF NOT EXISTS review_requested_at timestamp(6) without time zone;
