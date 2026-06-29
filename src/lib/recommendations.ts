import type { MenuItem } from "./menu-types";
import type { CartLine } from "./cart-store";

/**
 * Lightweight, deterministic recommendation engine.
 * Combines three signals:
 *  1. Hardcoded complementary keyword pairings (coffee → brownie, burger → fries, …).
 *  2. Co-occurrence frequencies from recent order_items pairs.
 *  3. Same-category popular items as a fallback.
 *
 * Excludes anything already in the cart and items that aren't available.
 */

const KEYWORD_PAIRS: Array<{ match: RegExp; suggest: RegExp[] }> = [
  { match: /\b(coffee|espresso|latte|cappuccino|mocha|cold\s*brew|americano)\b/i,
    suggest: [/brownie/i, /cookie/i, /muffin/i, /croissant/i, /cake/i, /garlic\s*bread/i] },
  { match: /\b(tea|chai|matcha)\b/i,
    suggest: [/biscuit/i, /scone/i, /muffin/i, /cookie/i, /sandwich/i] },
  { match: /\bburger\b/i,
    suggest: [/fries|fry/i, /soda|cola|soft\s*drink|coke|sprite/i, /milkshake/i, /brownie/i, /onion\s*rings/i] },
  { match: /\bpizza\b/i,
    suggest: [/garlic\s*bread/i, /soda|cola|soft\s*drink|coke/i, /ice\s*cream/i, /salad/i, /wings/i] },
  { match: /\bpasta\b/i,
    suggest: [/garlic\s*bread/i, /salad/i, /soup/i, /tiramisu/i, /wine|mocktail/i] },
  { match: /\bsandwich|wrap|panini\b/i,
    suggest: [/fries|fry/i, /soup/i, /coffee/i, /juice|smoothie|shake/i] },
  { match: /\b(fries|fry|nachos|wings)\b/i,
    suggest: [/burger/i, /soda|cola|soft\s*drink/i, /milkshake/i] },
  { match: /\bbreakfast|pancake|waffle|omelette|omelet\b/i,
    suggest: [/coffee|latte|cappuccino/i, /juice/i, /fruit\s*bowl|fruits/i] },
  { match: /\bdessert|cake|brownie|cheesecake|ice\s*cream\b/i,
    suggest: [/coffee|espresso|latte/i, /tea/i] },
  { match: /\bsalad\b/i,
    suggest: [/soup/i, /juice|smoothie/i, /sandwich|wrap/i] },
];

function keywordMatches(cart: CartLine[], candidate: MenuItem): number {
  let score = 0;
  for (const line of cart) {
    for (const pair of KEYWORD_PAIRS) {
      if (pair.match.test(line.name)) {
        for (const re of pair.suggest) {
          if (re.test(candidate.name)) score += 3;
        }
      }
    }
  }
  return score;
}

type CoMap = Map<string, Map<string, number>>; // item_id -> (item_id -> count)

export type CoOccurrence = CoMap;

/** Build co-occurrence map from a flat list of order_items rows. */
export function buildCoOccurrence(
  rows: Array<{ order_id: string; menu_item_id: string | null }>
): CoMap {
  const byOrder = new Map<string, string[]>();
  for (const r of rows) {
    if (!r.menu_item_id) continue;
    const list = byOrder.get(r.order_id) ?? [];
    list.push(r.menu_item_id);
    byOrder.set(r.order_id, list);
  }
  const co: CoMap = new Map();
  for (const items of byOrder.values()) {
    const uniq = Array.from(new Set(items));
    for (let i = 0; i < uniq.length; i++) {
      for (let j = 0; j < uniq.length; j++) {
        if (i === j) continue;
        const a = uniq[i], b = uniq[j];
        const inner = co.get(a) ?? new Map<string, number>();
        inner.set(b, (inner.get(b) ?? 0) + 1);
        co.set(a, inner);
      }
    }
  }
  return co;
}

export function recommend({
  cart, items, co, limit = 5,
}: {
  cart: CartLine[];
  items: MenuItem[];
  co: CoMap;
  limit?: number;
}): MenuItem[] {
  const inCart = new Set(cart.map((l) => l.menu_item_id));
  const cartCategories = new Set(
    cart
      .map((l) => items.find((i) => i.id === l.menu_item_id)?.category_id)
      .filter(Boolean) as string[]
  );

  const scored = new Map<string, number>();

  // 1. Keyword complementary pairings
  for (const candidate of items) {
    if (inCart.has(candidate.id) || !candidate.available) continue;
    const s = keywordMatches(cart, candidate);
    if (s > 0) scored.set(candidate.id, (scored.get(candidate.id) ?? 0) + s);
  }

  // 2. Co-occurrence (frequently ordered together)
  for (const line of cart) {
    const inner = co.get(line.menu_item_id);
    if (!inner) continue;
    for (const [otherId, count] of inner) {
      if (inCart.has(otherId)) continue;
      const cand = items.find((i) => i.id === otherId);
      if (!cand?.available) continue;
      scored.set(otherId, (scored.get(otherId) ?? 0) + count * 2);
    }
  }

  // 3. Fallback: other items from the same categories as cart
  if (cart.length > 0) {
    for (const candidate of items) {
      if (inCart.has(candidate.id) || !candidate.available) continue;
      if (candidate.category_id && cartCategories.has(candidate.category_id)) {
        scored.set(candidate.id, (scored.get(candidate.id) ?? 0) + 0.5);
      }
    }
  }

  // 4. If cart empty or no score at all, surface available items
  if (scored.size < 3) {
    for (const candidate of items) {
      if (inCart.has(candidate.id) || !candidate.available) continue;
      if (!scored.has(candidate.id)) scored.set(candidate.id, 0.1);
    }
  }

  return Array.from(scored.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => items.find((i) => i.id === id))
    .filter(Boolean) as MenuItem[];
}
