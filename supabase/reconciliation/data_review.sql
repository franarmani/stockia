\set ON_ERROR_STOP on
BEGIN READ ONLY;
WITH supplier_digits AS (
  SELECT supplier.id, supplier.name, supplier.business_id, supplier.cuit,
         business.name AS business_name,
         regexp_replace(coalesce(supplier.cuit, ''), '[^0-9]', '', 'g') AS digits
  FROM public.suppliers supplier
  JOIN public.businesses business ON business.id = supplier.business_id
  WHERE supplier.cuit IS NOT NULL
), supplier_checks AS (
  SELECT supplier_digits.*,
         CASE WHEN digits ~ '^[0-9]{11}$' THEN
           (SELECT sum(substring(digits, position::integer, 1)::integer * weight)
            FROM unnest(ARRAY[5,4,3,2,7,6,5,4,3,2]) WITH ORDINALITY AS weights(weight, position))
         END AS weighted_sum
  FROM supplier_digits
), invalid_suppliers AS (
  SELECT * FROM supplier_checks
  WHERE CASE WHEN weighted_sum IS NULL THEN true ELSE
    right(digits, 1)::integer <> CASE 11 - weighted_sum % 11
      WHEN 11 THEN 0 WHEN 10 THEN 9 ELSE 11 - weighted_sum % 11 END
  END
), mismatched_sales AS (
  SELECT sale.id, sale.created_at, sale.total, sale.business_id,
         business.name AS business_name, sale.seller_id,
         seller.name AS seller_name, seller.business_id AS seller_current_business_id,
         seller_business.name AS seller_current_business_name
  FROM public.sales sale
  JOIN public.businesses business ON business.id = sale.business_id
  JOIN public.users seller ON seller.id = sale.seller_id
  LEFT JOIN public.businesses seller_business ON seller_business.id = seller.business_id
  WHERE sale.business_id IS DISTINCT FROM seller.business_id
)
SELECT jsonb_pretty(jsonb_build_object(
  'scope', 'Revision manual sobre copia local. No ejecutar actualizaciones con valores no verificados.',
  'suppliers', coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id', id, 'name', name, 'business_id', business_id, 'business_name', business_name,
    'original_cuit', cuit, 'verified_cuit', NULL, 'evidence', NULL
  ) ORDER BY id) FROM invalid_suppliers), '[]'::jsonb),
  'sales', coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id', id, 'created_at', created_at, 'total', total, 'business_id', business_id,
    'business_name', business_name, 'original_seller_id', seller_id, 'seller_name', seller_name,
    'seller_current_business_id', seller_current_business_id,
    'seller_current_business_name', seller_current_business_name,
    'confirmed_seller_id', NULL, 'evidence', NULL,
    'current_business_users', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', candidate.id, 'name', candidate.name) ORDER BY candidate.name), '[]'::jsonb)
      FROM public.users candidate WHERE candidate.business_id = mismatched_sales.business_id)
  ) ORDER BY created_at, id) FROM mismatched_sales), '[]'::jsonb)
));
ROLLBACK;
