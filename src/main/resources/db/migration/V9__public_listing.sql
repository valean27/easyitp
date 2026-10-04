-- Statia apare in lista publica de statii (pagina /statii pentru soferi); null = da, daca are programarea online pornita
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS public_listing boolean;
