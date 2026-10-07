-- Programul saptamanal al inspectorului: in ce zile lucreaza, pe ce linie (null = linia lui obisnuita) si orele.
-- Fara niciun rand = fara program fix (e pe linia lui in fiecare zi).
CREATE TABLE inspector_days (
    inspector_id bigint NOT NULL REFERENCES inspectors (id) ON DELETE CASCADE,
    weekday integer NOT NULL,
    line_no integer,
    start_time time(6) without time zone,
    end_time time(6) without time zone,
    PRIMARY KEY (inspector_id, weekday)
);

-- Contul propriu al inspectorului (rol INSPECTOR): leaga contul de inspector; parola data de altcineva
-- (managerul sau contul creat automat) trebuie schimbata la prima logare
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS inspector_id bigint REFERENCES inspectors (id) ON DELETE CASCADE;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_change_required boolean;
CREATE INDEX IF NOT EXISTS idx_app_users_inspector ON app_users (inspector_id);
