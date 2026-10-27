-- Cierre de caja automático a una hora fija (HH:MM, hora del equipo). null = desactivado.
alter table public.businesses add column if not exists cash_auto_close_time text
  check (cash_auto_close_time is null or cash_auto_close_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
