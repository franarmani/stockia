-- Migracion historica recuperada: columnas de comprobantes AFIP.
-- Debe ejecutarse despues del nucleo v2 y antes de AFIP Complete/Fiscal.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS cbte_tipo INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS doc_tipo INTEGER NOT NULL DEFAULT 99,
  ADD COLUMN IF NOT EXISTS doc_nro TEXT,
  ADD COLUMN IF NOT EXISTS iva_condition_customer TEXT,
  ADD COLUMN IF NOT EXISTS neto_gravado NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS neto_no_gravado NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exento NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tributos NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS afip_request TEXT,
  ADD COLUMN IF NOT EXISTS afip_response TEXT,
  ADD COLUMN IF NOT EXISTS voided BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS credit_note_for UUID REFERENCES public.invoices(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_invoices_credit_note_for
  ON public.invoices(credit_note_for);
