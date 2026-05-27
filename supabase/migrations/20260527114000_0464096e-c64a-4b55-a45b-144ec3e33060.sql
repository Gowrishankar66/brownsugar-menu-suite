
-- 1) Revoke EXECUTE on SECURITY DEFINER functions from anon/public.
-- has_role is called inside RLS policies (server-side), no need for anon EXECUTE.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.assign_first_user_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_order_number() FROM PUBLIC, anon, authenticated;

-- 2) Replace overly permissive INSERT policies on orders / order_items
-- with sanity-checked policies. Anonymous customers still order via QR, but
-- inserts must satisfy basic integrity rules.
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
CREATE POLICY "Anyone can create orders"
ON public.orders
FOR INSERT
TO anon, authenticated
WITH CHECK (
  table_number > 0
  AND status = 'received'
  AND subtotal >= 0
  AND gst_amount >= 0
  AND total >= 0
  AND (notes IS NULL OR length(notes) <= 500)
);

DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;
CREATE POLICY "Anyone can create order items"
ON public.order_items
FOR INSERT
TO anon, authenticated
WITH CHECK (
  quantity > 0
  AND quantity <= 100
  AND unit_price >= 0
  AND line_subtotal >= 0
  AND line_gst >= 0
  AND line_total >= 0
  AND gst_percentage >= 0
  AND gst_percentage <= 100
  AND length(name) <= 200
  AND (special_instructions IS NULL OR length(special_instructions) <= 500)
  AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id)
);
