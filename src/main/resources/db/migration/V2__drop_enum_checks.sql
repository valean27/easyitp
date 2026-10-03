-- Hibernate (ddl-auto=update) a pus pe coloanele enum un CHECK cu valorile de la crearea tabelului;
-- o valoare noua (ex. rolul FLEET) ar fi respinsa. Enum-ul e validat oricum in Java. Inlocuieste SchemaFixes.
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check;
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_digest_channel_check;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_source_check;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_vehicle_category_check;
ALTER TABLE itp_records DROP CONSTRAINT IF EXISTS itp_records_reminder_status_check;
ALTER TABLE itp_records DROP CONSTRAINT IF EXISTS itp_records_status_check;
