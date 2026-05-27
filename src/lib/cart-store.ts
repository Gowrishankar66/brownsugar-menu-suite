import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartLine = {
  menu_item_id: string;
  name: string;
  sku: string | null;
  unit_price: number;
  gst_percentage: number;
  quantity: number;
  special_instructions?: string;
  image_url?: string | null;
};

type State = {
  // keyed by tableNumber
  carts: Record<string, CartLine[]>;
  lastOrders: Record<string, string>; // tableNumber -> orderId
  add: (table: string, line: Omit<CartLine, "quantity">) => void;
  setQty: (table: string, menu_item_id: string, qty: number) => void;
  setInstructions: (table: string, menu_item_id: string, notes: string) => void;
  remove: (table: string, menu_item_id: string) => void;
  clear: (table: string) => void;
  setLastOrder: (table: string, id: string) => void;
};

const EMPTY_CART: CartLine[] = [];
export const selectCart = (table: string) => (s: State) => s.carts[table] ?? EMPTY_CART;

export const useCart = create<State>()(
  persist(
    (set) => ({
      carts: {},
      lastOrders: {},
      add: (table, line) =>
        set((s) => {
          const cart = s.carts[table] ?? [];
          const idx = cart.findIndex((l) => l.menu_item_id === line.menu_item_id);
          const next = [...cart];
          if (idx >= 0) next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
          else next.push({ ...line, quantity: 1 });
          return { carts: { ...s.carts, [table]: next } };
        }),
      setQty: (table, id, qty) =>
        set((s) => {
          const cart = s.carts[table] ?? [];
          const next = qty <= 0 ? cart.filter((l) => l.menu_item_id !== id) : cart.map((l) => (l.menu_item_id === id ? { ...l, quantity: qty } : l));
          return { carts: { ...s.carts, [table]: next } };
        }),
      setInstructions: (table, id, notes) =>
        set((s) => {
          const cart = s.carts[table] ?? [];
          const next = cart.map((l) => (l.menu_item_id === id ? { ...l, special_instructions: notes } : l));
          return { carts: { ...s.carts, [table]: next } };
        }),
      remove: (table, id) =>
        set((s) => ({ carts: { ...s.carts, [table]: (s.carts[table] ?? []).filter((l) => l.menu_item_id !== id) } })),
      clear: (table) => set((s) => ({ carts: { ...s.carts, [table]: [] } })),
      setLastOrder: (table, id) => set((s) => ({ lastOrders: { ...s.lastOrders, [table]: id } })),
    }),
    { name: "brownsugar-cart-v1" }
  )
);

export function lineTotals(line: CartLine) {
  const subtotal = line.unit_price * line.quantity;
  const gst = subtotal * (line.gst_percentage / 100);
  return { subtotal, gst, total: subtotal + gst };
}

export function cartTotals(cart: CartLine[]) {
  let subtotal = 0, gst = 0;
  for (const l of cart) {
    const t = lineTotals(l);
    subtotal += t.subtotal; gst += t.gst;
  }
  return { subtotal, gst, total: subtotal + gst };
}
