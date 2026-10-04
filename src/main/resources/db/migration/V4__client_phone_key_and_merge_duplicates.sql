-- Telefonul clientului redus la ultimele 9 cifre ("0722 111 222", "+40722111222" -> "722111222"),
-- ca acelasi om sa fie gasit indiferent cum a fost scris numarul. Completat de entitate la fiecare salvare.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone_key character varying(20);
UPDATE clients SET phone_key = NULLIF(RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 9), '');
CREATE INDEX IF NOT EXISTS idx_clients_user_phone_key ON clients (user_id, phone_key);

-- 1) Vehicule dublate: acelasi numar (normalizat) la aceeasi statie e acelasi vehicul. ITP-urile trec pe vehiculul
--    cu cel mai recent ITP (datele lui sunt cele mai noi), celelalte vehicule se sterg.
CREATE TEMP TABLE vehicle_keeper ON COMMIT DROP AS
SELECT id,
       FIRST_VALUE(id) OVER (PARTITION BY user_id, normalized_plate ORDER BY last_test DESC NULLS LAST, id DESC) AS keeper
FROM (SELECT v.id, c.user_id, v.normalized_plate,
             (SELECT MAX(r.test_date) FROM itp_records r WHERE r.vehicle_id = v.id) AS last_test
      FROM vehicles v JOIN clients c ON c.id = v.client_id
      WHERE c.user_id IS NOT NULL AND v.normalized_plate <> '') x;

UPDATE itp_records r SET vehicle_id = k.keeper FROM vehicle_keeper k WHERE r.vehicle_id = k.id AND k.id <> k.keeper;
DELETE FROM vehicles v USING vehicle_keeper k WHERE v.id = k.id AND k.id <> k.keeper;

-- 2) Clienti dublati: acelasi nume (fara diferente de majuscule/spatii) si acelasi telefon la aceeasi statie.
--    Vechea logica facea cate un client pentru fiecare masina; masinile trec la clientul cel mai vechi.
CREATE TEMP TABLE client_keeper ON COMMIT DROP AS
SELECT id,
       FIRST_VALUE(id) OVER (PARTITION BY user_id, LOWER(TRIM(name)), phone_key ORDER BY id) AS keeper
FROM clients
WHERE user_id IS NOT NULL AND phone_key IS NOT NULL;

UPDATE vehicles v SET client_id = k.keeper FROM client_keeper k WHERE v.client_id = k.id AND k.id <> k.keeper;
DELETE FROM clients c USING client_keeper k WHERE c.id = k.id AND k.id <> k.keeper;

-- 3) Clienti ramasi fara nicio masina (dupa stergeri vechi) nu mai au ce afisa
DELETE FROM clients c WHERE c.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM vehicles v WHERE v.client_id = c.id);
