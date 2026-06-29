import type { MenuItem } from "./menu-types";
import type { CartLine } from "./cart-store";

export type PromotionType =
  | "bogo" | "b2g1" | "combo" | "flat_discount" | "percent_discount"
  | "free_dessert" | "free_beverage" | "festival" | "happy_hour"
  | "weekend" | "custom";

export type Promotion = {
  id: string;
  name: string;
  description: string | null;
  type: PromotionType;
  eligible_item_ids: string[];
  eligible_category_ids: string[];
  reward_item_ids: string[];
  reward_category_ids: string[];
  discount_value: number;
  min_subtotal: number;
  start_date: string | null;
  end_date: string | null;
  active: boolean;
  max_usage: number | null;
  usage_count: number;
  views_count: number;
  revenue_generated: number;
  created_at: string;
};

export const PROMO_TYPE_LABELS: Record<PromotionType, string> = {
  bogo: "Buy 1 Get 1 Free",
  b2g1: "Buy 2 Get 1 Free",
  combo: "Combo Offer",
  flat_discount: "Flat ₹ Discount",
  percent_discount: "% Discount",
  free_dessert: "Free Dessert",
  free_beverage: "Free Beverage",
  festival: "Festival Special",
  happy_hour: "Happy Hour",
  weekend: "Weekend Offer",
  custom: "Custom Offer",
};

export function isActiveNow(p: Promotion, now = new Date()): boolean {
  if (!p.active) return false;
  if (p.max_usage != null && p.usage_count >= p.max_usage) return false;
  if (p.start_date && new Date(p.start_date) > now) return false;
  if (p.end_date && new Date(p.end_date) < now) return false;
  if (p.type === "happy_hour") {
    const h = now.getHours();
    if (h < 16 || h >= 19) return false; // 4–7 PM default window
  }
  if (p.type === "weekend") {
    const d = now.getDay();
    if (d !== 0 && d !== 6) return false;
  }
  return true;
}

function itemMatches(item: MenuItem | undefined, p: Promotion): boolean {
  if (!item) return false;
  if (p.eligible_item_ids.includes(item.id)) return true;
  if (item.category_id && p.eligible_category_ids.includes(item.category_id)) return true;
  // If no specific scope, applies to whole cart
  return p.eligible_item_ids.length === 0 && p.eligible_category_ids.length === 0;
}

export type PromotionSuggestion = {
  promotion: Promotion;
  /** Already fulfilled by current cart? */
  fulfilled: boolean;
  /** Human-friendly suggestion text */
  message: string;
  /** Item the user could add to unlock — if applicable */
  addItem?: MenuItem;
  /** Estimated reward value used for analytics */
  rewardValue: number;
};

export function evaluatePromotions({
  cart, items, promotions, now = new Date(),
}: {
  cart: CartLine[];
  items: MenuItem[];
  promotions: Promotion[];
  now?: Date;
}): PromotionSuggestion[] {
  const out: PromotionSuggestion[] = [];
  const subtotal = cart.reduce((s, l) => s + l.unit_price * l.quantity, 0);
  const cartItemIds = new Set(cart.map((l) => l.menu_item_id));
  const cartItems = cart.map((l) => items.find((i) => i.id === l.menu_item_id)).filter(Boolean) as MenuItem[];

  for (const p of promotions) {
    if (!isActiveNow(p, now)) continue;

    // Eligible items currently in cart
    const eligibleInCart = cartItems.filter((it) => itemMatches(it, p));
    const eligibleQty = cart
      .filter((l) => eligibleInCart.some((i) => i.id === l.menu_item_id))
      .reduce((n, l) => n + l.quantity, 0);

    // Reward item (first reward candidate that exists in menu)
    const rewardItem =
      items.find((i) => p.reward_item_ids.includes(i.id) && i.available) ??
      items.find((i) => i.category_id && p.reward_category_ids.includes(i.category_id) && i.available);

    const rewardValue = rewardItem ? Number(rewardItem.price) : Number(p.discount_value || 0);

    switch (p.type) {
      case "bogo": {
        if (eligibleQty >= 2) {
          out.push({ promotion: p, fulfilled: true, message: `🎉 ${p.name} unlocked!`, rewardValue });
        } else if (eligibleQty === 1) {
          const it = eligibleInCart[0];
          out.push({
            promotion: p, fulfilled: false,
            message: `🎉 Add 1 more ${it?.name ?? "eligible item"} to get one FREE`,
            addItem: it, rewardValue,
          });
        }
        break;
      }
      case "b2g1": {
        if (eligibleQty >= 3) {
          out.push({ promotion: p, fulfilled: true, message: `🎉 ${p.name} unlocked!`, rewardValue });
        } else if (eligibleQty === 2 && eligibleInCart[0]) {
          out.push({
            promotion: p, fulfilled: false,
            message: `🥳 Add 1 more ${eligibleInCart[0].name} — third one is FREE`,
            addItem: eligibleInCart[0], rewardValue,
          });
        }
        break;
      }
      case "free_dessert":
      case "free_beverage":
      case "combo": {
        if (eligibleQty >= 1 && rewardItem && !cartItemIds.has(rewardItem.id)) {
          out.push({
            promotion: p, fulfilled: false,
            message: `🍰 Add ${rewardItem.name} and unlock ${p.name}`,
            addItem: rewardItem, rewardValue,
          });
        } else if (eligibleQty >= 1 && rewardItem && cartItemIds.has(rewardItem.id)) {
          out.push({ promotion: p, fulfilled: true, message: `✨ ${p.name} unlocked!`, rewardValue });
        }
        break;
      }
      case "flat_discount":
      case "percent_discount":
      case "festival":
      case "happy_hour":
      case "weekend":
      case "custom": {
        if (subtotal >= (p.min_subtotal || 0)) {
          const rv =
            p.type === "percent_discount"
              ? Math.round(subtotal * (p.discount_value / 100) * 100) / 100
              : Number(p.discount_value || 0);
          out.push({
            promotion: p, fulfilled: true,
            message: `🎁 ${p.name}${p.description ? ` — ${p.description}` : ""}`,
            rewardValue: rv,
          });
        } else if (p.min_subtotal) {
          const need = p.min_subtotal - subtotal;
          out.push({
            promotion: p, fulfilled: false,
            message: `💸 Spend ₹${need.toFixed(0)} more to unlock ${p.name}`,
            rewardValue: 0,
          });
        }
        break;
      }
    }
  }

  return out;
}
