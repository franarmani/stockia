-- Nota libre en la venta (ej. cuenta corriente sin cliente: quién se lo llevó / para qué obra)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS note TEXT;
