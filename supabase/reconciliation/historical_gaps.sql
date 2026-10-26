CREATE INDEX IF NOT EXISTS idx_customer_payments_customer
  ON public.customer_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_business
  ON public.customer_payments(business_id);
CREATE INDEX IF NOT EXISTS idx_invoices_credit_note_for
  ON public.invoices(credit_note_for);
CREATE INDEX IF NOT EXISTS idx_invoices_business_cbte
  ON public.invoices(business_id, cbte_tipo, invoice_number);

CREATE OR REPLACE FUNCTION public.frequently_bought_together(
  p_business_id UUID,
  p_product_id UUID,
  p_limit INTEGER DEFAULT 3
)
RETURNS TABLE(product_id UUID, product_name TEXT, co_count BIGINT)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT related_item.product_id, related_product.name, COUNT(*) AS co_count
  FROM public.sale_items source_item
  JOIN public.sale_items related_item
    ON related_item.sale_id = source_item.sale_id
   AND related_item.product_id <> source_item.product_id
  JOIN public.sales source_sale ON source_sale.id = source_item.sale_id
  JOIN public.products source_product ON source_product.id = source_item.product_id
  JOIN public.products related_product ON related_product.id = related_item.product_id
  WHERE source_sale.business_id = p_business_id
    AND p_business_id = public.get_user_business_id()
    AND source_product.business_id = p_business_id
    AND related_product.business_id = p_business_id
    AND source_item.product_id = p_product_id
    AND source_sale.voided = false
    AND source_sale.created_at >= now() - interval '90 days'
  GROUP BY related_item.product_id, related_product.name
  ORDER BY co_count DESC, related_item.product_id
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.frequently_bought_together(UUID, UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.frequently_bought_together(UUID, UUID, INTEGER) TO authenticated;
