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
};
