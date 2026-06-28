
-- Order source tagging
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'qr'
  CHECK (source IN ('qr','manual'));

-- Allow admins to create manual orders bypassing the anon insert constraints
DROP POLICY IF EXISTS "Admins can create manual orders" ON public.orders;
CREATE POLICY "Admins can create manual orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND table_number > 0
    AND status IN ('new','accepted')
    AND subtotal >= 0
    AND gst_amount >= 0
    AND cgst_amount >= 0
    AND sgst_amount >= 0
    AND total >= 0
  );

DROP POLICY IF EXISTS "Admins can create order items" ON public.order_items;
CREATE POLICY "Admins can create order items" ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND quantity > 0 AND quantity <= 100
    AND unit_price >= 0
    AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id)
  );
