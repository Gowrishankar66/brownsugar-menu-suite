import { supabase } from "@/integrations/supabase/client";
import { gstFromSubtotal, recomputeLine } from "@/lib/gst";
import type { ActorRole, AmendmentAction, OrderItem, OrderStatus } from "@/lib/menu-types";

/** Re-sum all items for an order and persist split-GST totals. */
export async function recomputeOrderTotals(orderId: string) {
  const { data } = await supabase
    .from("order_items")
    .select("line_subtotal")
    .eq("order_id", orderId);
  const subtotal = (data ?? []).reduce((s, r) => s + Number(r.line_subtotal), 0);
  const t = gstFromSubtotal(subtotal);
  await supabase
    .from("orders")
    .update({
      subtotal,
      gst_amount: t.gst,
      cgst_amount: t.cgst,
      sgst_amount: t.sgst,
      total: t.total,
    })
    .eq("id", orderId);
}

export async function logAmendment(
  orderId: string,
  role: ActorRole,
  action: AmendmentAction,
  details: Record<string, unknown>,
) {
  const { data: u } = await supabase.auth.getUser();
  await supabase.from("order_amendments").insert({
    order_id: orderId,
    actor_role: role,
    actor_user_id: u.user?.id ?? null,
    action,
    details,
  });
}

export async function changeItemQuantity(
  orderId: string,
  item: OrderItem,
  nextQty: number,
  role: ActorRole,
) {
  if (nextQty <= 0) return removeItem(orderId, item, role);
  const t = recomputeLine(Number(item.unit_price), nextQty);
  await supabase
    .from("order_items")
    .update({ quantity: nextQty, ...t })
    .eq("id", item.id);
  await logAmendment(orderId, role, "quantity_changed", {
    item: item.name,
    from: item.quantity,
    to: nextQty,
  });
  await recomputeOrderTotals(orderId);
}

export async function removeItem(orderId: string, item: OrderItem, role: ActorRole) {
  await supabase.from("order_items").delete().eq("id", item.id);
  await logAmendment(orderId, role, "item_removed", {
    item: item.name,
    quantity: item.quantity,
  });
  await recomputeOrderTotals(orderId);
}

export async function addItem(
  orderId: string,
  menuItem: {
    id: string;
    name: string;
    sku: string | null;
    price: number;
    gst_percentage?: number;
  },
  quantity: number,
  role: ActorRole,
) {
  const t = recomputeLine(Number(menuItem.price), quantity);
  await supabase.from("order_items").insert({
    order_id: orderId,
    menu_item_id: menuItem.id,
    name: menuItem.name,
    sku: menuItem.sku,
    unit_price: menuItem.price,
    gst_percentage: 5,
    quantity,
    special_instructions: null,
    ...t,
  });
  await logAmendment(orderId, role, "item_added", {
    item: menuItem.name,
    quantity,
  });
  await recomputeOrderTotals(orderId);
}

export async function setOrderNote(orderId: string, note: string, role: ActorRole) {
  await supabase.from("orders").update({ notes: note }).eq("id", orderId);
  await logAmendment(orderId, role, "note_added", { note });
}

export async function setOrderStatus(
  orderId: string,
  next: OrderStatus,
  role: ActorRole,
  prev?: OrderStatus,
) {
  const patch: Record<string, unknown> = { status: next };
  if (next === "accepted") patch.accepted_at = new Date().toISOString();
  if (next === "completed") patch.completed_at = new Date().toISOString();
  await supabase.from("orders").update(patch).eq("id", orderId);
  await logAmendment(orderId, role, "status_changed", { from: prev ?? null, to: next });
}
