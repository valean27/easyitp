-- Stergerea contului la cererea statiei (GDPR): contul se dezactiveaza imediat, iar datele se sterg definitiv dupa
-- 30 de zile (AccountDeletionService), timp in care adminul poate anula cererea
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS deletion_requested_at timestamp(6) without time zone;
