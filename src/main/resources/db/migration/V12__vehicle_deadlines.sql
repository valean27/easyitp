-- Alte scadente ale masinii (C4): RCA, rovinieta, verificarea tahografului. Optionale, completate de statie.
-- contacted_at = cand a sunat/scris statia pentru scadenta curenta (se sterge cand data se schimba).
CREATE TABLE vehicle_deadlines (
    vehicle_id bigint NOT NULL REFERENCES vehicles (id) ON DELETE CASCADE,
    kind character varying(20) NOT NULL,
    due_date date NOT NULL,
    contacted_at timestamp(6) without time zone,
    CONSTRAINT uk_vehicle_deadlines_vehicle_kind UNIQUE (vehicle_id, kind)
);
CREATE INDEX idx_vehicle_deadlines_due ON vehicle_deadlines (due_date);

-- SMS automat si pentru aceste scadente (o singura treapta, cu 7 zile inainte)
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS auto_sms_deadlines boolean;

-- Jurnalul SMS-urilor automate tine si scadentele: itp_record_id gol, cu masina, tipul si data scadentei
ALTER TABLE reminder_sends ALTER COLUMN itp_record_id DROP NOT NULL;
ALTER TABLE reminder_sends ADD COLUMN IF NOT EXISTS vehicle_id bigint;
ALTER TABLE reminder_sends ADD COLUMN IF NOT EXISTS kind character varying(20);
ALTER TABLE reminder_sends ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE reminder_sends ADD CONSTRAINT uk_reminder_sends_deadline UNIQUE (vehicle_id, kind, due_date);
