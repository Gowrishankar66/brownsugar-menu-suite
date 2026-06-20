
-- 1. Orders: split GST + new workflow statuses
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cgst_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Backfill split GST from existing gst_amount (assume even split going forward)
UPDATE public.orders
SET cgst_amount = ROUND(gst_amount / 2.0, 2),
    sgst_amount = gst_amount - ROUND(gst_amount / 2.0, 2)
WHERE cgst_amount = 0 AND sgst_amount = 0 AND gst_amount > 0;

-- Migrate existing 'received' rows to 'new'
UPDATE public.orders SET status = 'new' WHERE status = 'received';

-- Replace status check constraint
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status = ANY (ARRAY['new','accepted','preparing','ready','served','completed','cancelled']));

ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'new';

-- 2. Order items: split GST + relax per-item gst
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS line_cgst numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS line_sgst numeric NOT NULL DEFAULT 0;

UPDATE public.order_items
SET line_cgst = ROUND(line_gst / 2.0, 2),
    line_sgst = line_gst - ROUND(line_gst / 2.0, 2)
WHERE line_cgst = 0 AND line_sgst = 0 AND line_gst > 0;

ALTER TABLE public.order_items ALTER COLUMN gst_percentage SET DEFAULT 5;

-- 3. Tighten / relax insert policies for new workflow
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
CREATE POLICY "Anyone can create orders" ON public.orders
  FOR INSERT
  WITH CHECK (
    table_number > 0
    AND status = 'new'
    AND subtotal >= 0
    AND gst_amount >= 0
    AND cgst_amount >= 0
    AND sgst_amount >= 0
    AND total >= 0
    AND (notes IS NULL OR length(notes) <= 500)
  );

DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;
CREATE POLICY "Anyone can create order items" ON public.order_items
  FOR INSERT
  WITH CHECK (
    quantity > 0 AND quantity <= 100
    AND unit_price >= 0
    AND line_subtotal >= 0
    AND line_gst >= 0
    AND line_cgst >= 0
    AND line_sgst >= 0
    AND line_total >= 0
    AND gst_percentage >= 0 AND gst_percentage <= 100
    AND length(name) <= 200
    AND (special_instructions IS NULL OR length(special_instructions) <= 500)
    AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id)
  );

-- 4. Order amendments log
CREATE TABLE IF NOT EXISTS public.order_amendments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  actor_role text NOT NULL CHECK (actor_role IN ('admin','kitchen','customer','system')),
  actor_user_id uuid,
  action text NOT NULL CHECK (action IN ('item_added','item_removed','quantity_changed','note_added','status_changed')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_amendments_order_id_idx ON public.order_amendments(order_id, created_at);

GRANT SELECT ON public.order_amendments TO anon;
GRANT SELECT, INSERT ON public.order_amendments TO authenticated;
GRANT ALL ON public.order_amendments TO service_role;

ALTER TABLE public.order_amendments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Amendments viewable by everyone" ON public.order_amendments
  FOR SELECT USING (true);

CREATE POLICY "Admins manage amendments" ON public.order_amendments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Authenticated staff (kitchen view requires admin sign-in in this app) can append entries
CREATE POLICY "Authenticated can append amendments" ON public.order_amendments
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_role IN ('admin','kitchen','system')
    AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_amendments.order_id)
  );

-- 5. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_amendments;
