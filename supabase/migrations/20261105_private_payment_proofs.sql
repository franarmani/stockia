-- Los comprobantes de pago tienen datos bancarios: dejan de ser públicos por URL.
-- Los lee el propio negocio y el superadmin (políticas de 20261101); el panel admin usa links firmados.
update storage.buckets set public = false where id = 'payment-proofs';
