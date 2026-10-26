-- Datos del negocio que se piden al registrarse: rubro y provincia (el resto ya existía:
-- teléfono, dirección, ciudad, CUIT, razón social y condición frente al IVA).
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS business_type TEXT,
  ADD COLUMN IF NOT EXISTS province TEXT;
