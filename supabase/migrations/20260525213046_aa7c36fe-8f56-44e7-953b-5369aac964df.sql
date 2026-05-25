
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS sku text UNIQUE,
  ADD COLUMN IF NOT EXISTS gst_percentage numeric NOT NULL DEFAULT 18;

WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY created_at) AS rn
  FROM public.menu_items WHERE sku IS NULL
)
UPDATE public.menu_items m
SET sku = 'ITM-' || lpad(n.rn::text, 4, '0')
FROM numbered n WHERE m.id = n.id;

CREATE TABLE IF NOT EXISTS public.tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number int NOT NULL UNIQUE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tables viewable by everyone" ON public.tables FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage tables" ON public.tables FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

INSERT INTO public.tables (table_number, name)
SELECT g, 'Table ' || g FROM generate_series(1,10) g
ON CONFLICT (table_number) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL,
  daily_seq int NOT NULL,
  order_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  table_id uuid REFERENCES public.tables(id) ON DELETE SET NULL,
  table_number int NOT NULL,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','preparing','ready','served','cancelled')),
  subtotal numeric NOT NULL DEFAULT 0,
  gst_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_date, daily_seq)
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Orders viewable by everyone" ON public.orders FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can create orders" ON public.orders FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins update orders" ON public.orders FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete orders" ON public.orders FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  name text NOT NULL,
  sku text,
  unit_price numeric NOT NULL,
  gst_percentage numeric NOT NULL,
  quantity int NOT NULL CHECK (quantity > 0),
  special_instructions text,
  line_subtotal numeric NOT NULL,
  line_gst numeric NOT NULL,
  line_total numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Order items viewable by everyone" ON public.order_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can create order items" ON public.order_items FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins manage order items" ON public.order_items FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS orders_status_idx ON public.orders(status);
CREATE INDEX IF NOT EXISTS orders_date_idx ON public.orders(order_date DESC);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON public.order_items(order_id);

CREATE OR REPLACE FUNCTION public.assign_order_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  next_seq int;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('orders_seq_' || d::text));
  SELECT COALESCE(MAX(daily_seq),0)+1 INTO next_seq FROM public.orders WHERE order_date = d;
  NEW.order_date := d;
  NEW.daily_seq := next_seq;
  NEW.order_number := lpad(next_seq::text, 3, '0');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS orders_assign_number ON public.orders;
CREATE TRIGGER orders_assign_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.assign_order_number();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS orders_touch ON public.orders;
CREATE TRIGGER orders_touch BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;
