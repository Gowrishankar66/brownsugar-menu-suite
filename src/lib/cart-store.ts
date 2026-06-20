import { create } from "zustand";
import { persist } from "zustand/middleware";
import { GST_RATE, gstFromSubtotal, recomputeLine } from "./gst";

export type CartLine = {
  menu_item_id: string;
  name: string;
  sku: string | null;
  unit_price: number;
  /** Kept for back-compat; system-wide GST is fixed at 5%. */
  gst_percentage: number;
  quantity: number;
  special_instructions?: string;
  image_url?: string | null;
};

type State = {
  carts: Record<string, CartLine[]>;
  lastOrders: Record<string, string>;
  add: (table: string, line: Omit<CartLine, "quantity" | "gst_percentage"> & { gst_percentage?: number }) => void;
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
          else next.push({ ...line, gst_percentage: GST_RATE, quantity: 1 });
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
    { name: "brownsugar-cart-v2" }
  )
);

export function lineTotals(line: CartLine) {
  const t = recomputeLine(line.unit_price, line.quantity);
  return { subtotal: t.line_subtotal, gst: t.line_gst, cgst: t.line_cgst, sgst: t.line_sgst, total: t.line_total };
}

export function cartTotals(cart: CartLine[]) {
  const subtotal = cart.reduce((s, l) => s + l.unit_price * l.quantity, 0);
  const t = gstFromSubtotal(subtotal);
  return { subtotal: Math.round(subtotal * 100) / 100, gst: t.gst, cgst: t.cgst, sgst: t.sgst, total: t.total };
}
