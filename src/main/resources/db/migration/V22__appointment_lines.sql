-- Linia ITP pe care e programata masina (1..numarul de linii); null = programari vechi, linia se alege la afisare
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS line_no integer;
-- Numele liniilor, cate unul pe rand (ex. "Linia 1 - autoturisme"); null = "Linia 1", "Linia 2" ...
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS booking_line_names varchar(500);
