export type Category = {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

export type MenuItem = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  veg_type: "veg" | "non-veg";
  available: boolean;
  sort_order: number;
  created_at: string;
  sku: string | null;
  gst_percentage: number;
};

export type CafeTable = {
  id: string;
  table_number: number;
  name: string;
  active: boolean;
  created_at: string;
};

export type OrderStatus = "received" | "preparing" | "ready" | "served" | "cancelled";

export type Order = {
  id: string;
  order_number: string;
  daily_seq: number;
  order_date: string;
  table_id: string | null;
  table_number: number;
  status: OrderStatus;
  subtotal: number;
  gst_amount: number;
  total: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  name: string;
  sku: string | null;
  unit_price: number;
  gst_percentage: number;
  quantity: number;
  special_instructions: string | null;
  line_subtotal: number;
  line_gst: number;
  line_total: number;
  created_at: string;
};
