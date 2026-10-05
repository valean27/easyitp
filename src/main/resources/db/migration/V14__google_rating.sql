-- Nota de pe Google a statiei (Google Places API): locul ales de statie si ultima nota citita
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS google_place_id character varying(300);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS google_rating double precision;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS google_rating_count integer;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS google_rating_at timestamp(6) without time zone;
