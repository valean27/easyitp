-- Numarul de inmatriculare fara spatii/cratime si cu majuscule (aceeasi regula ca PlateUtils.normalize),
-- ca "CJ 13-FAN" si "cj13fan" sa fie gasite printr-un index. Completat de entitate la fiecare salvare.
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS normalized_plate character varying(255);
UPDATE vehicles SET normalized_plate = UPPER(REPLACE(REPLACE(license_plate, ' ', ''), '-', ''));

CREATE INDEX IF NOT EXISTS idx_vehicles_normalized_plate ON vehicles (normalized_plate);
CREATE INDEX IF NOT EXISTS idx_vehicles_client ON vehicles (client_id);
CREATE INDEX IF NOT EXISTS idx_clients_user ON clients (user_id);
CREATE INDEX IF NOT EXISTS idx_itp_records_vehicle ON itp_records (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_itp_records_next_itp ON itp_records (next_itp_date);
CREATE INDEX IF NOT EXISTS idx_itp_records_test_date ON itp_records (test_date);
CREATE INDEX IF NOT EXISTS idx_appointments_user_date ON appointments (user_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_app_users_fleet ON app_users (fleet_id);
CREATE INDEX IF NOT EXISTS idx_fleets_user ON fleets (user_id);
CREATE INDEX IF NOT EXISTS idx_fleet_plates_fleet ON fleet_plates (fleet_id);
