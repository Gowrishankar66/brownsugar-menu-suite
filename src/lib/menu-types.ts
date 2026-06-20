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

export type OrderStatus =
  | "new"
  | "accepted"
  | "preparing"
  | "ready"
  | "served"
  | "completed"
  | "cancelled";

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
  cgst_amount: number;
  sgst_amount: number;
  total: number;
  notes: string | null;
  accepted_at: string | null;
  completed_at: string | null;
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
  line_cgst: number;
  line_sgst: number;
  line_total: number;
  created_at: string;
};

export type AmendmentAction =
  | "item_added"
  | "item_removed"
  | "quantity_changed"
  | "note_added"
  | "status_changed";

export type ActorRole = "admin" | "kitchen" | "customer" | "system";

export type OrderAmendment = {
  id: string;
  order_id: string;
  actor_role: ActorRole;
  actor_user_id: string | null;
  action: AmendmentAction;
  details: Record<string, unknown>;
  created_at: string;
};
