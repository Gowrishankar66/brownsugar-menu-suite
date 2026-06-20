import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { CheckCircle2, ChefHat, Clock, PartyPopper, Loader2, ArrowLeft, BellRing, Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Order, OrderItem, OrderStatus } from "@/lib/menu-types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const searchSchema = z.object({ table: z.coerce.number().int().positive().optional() });

export const Route = createFileRoute("/order-status/$orderId")({
  validateSearch: searchSchema,
  component: StatusPage,
  head: () => ({ meta: [{ title: "Order Status — BrownSugar" }, { name: "robots", content: "noindex" }] }),
});

const STEPS: { key: OrderStatus; label: string; Icon: typeof Clock }[] = [
  { key: "new", label: "Placed", Icon: BellRing },
  { key: "accepted", label: "Accepted", Icon: CheckCircle2 },
  { key: "preparing", label: "Preparing", Icon: ChefHat },
  { key: "ready", label: "Ready", Icon: PartyPopper },
  { key: "served", label: "Served", Icon: Flag },
];

function StatusPage() {
  const { orderId } = Route.useParams();
  const { table } = Route.useSearch();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const [o, i] = await Promise.all([
        supabase.from("orders").select("*").eq("id", orderId).maybeSingle(),
        supabase.from("order_items").select("*").eq("order_id", orderId).order("created_at"),
      ]);
      if (!mounted) return;
      setOrder((o.data as unknown as Order | null) ?? null);
      setItems(((i.data ?? []) as unknown) as OrderItem[]);
      setLoading(false);
    }
    load();
    const ch = supabase
      .channel(`order-${orderId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` }, (p) => setOrder(p.new as unknown as Order))
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items", filter: `order_id=eq.${orderId}` }, load)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [orderId]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!order) return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Order not found</p></div>;

  const stepIdx = Math.max(0, STEPS.findIndex((s) => s.key === order.status));
  const placed = new Date(order.created_at);
  const minutes = Math.max(5, items.reduce((n, i) => n + i.quantity, 0) * 2 + 8);

  return (
    <div className="min-h-screen bg-hero pb-12">
      <header className="border-b border-border/40 bg-card/70 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          {table ? (
            <Link to="/order" search={{ table }} aria-label="Back to menu to add more items" className="inline-flex items-center text-sm text-primary"><ArrowLeft className="mr-1 h-4 w-4" /> Add more items</Link>
          ) : <span />}
          <p className="text-xs text-muted-foreground">Table {order.table_number}</p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <section className="rounded-3xl bg-card p-8 text-center shadow-elegant">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Order Number</p>
          <p className="mt-1 font-display text-6xl font-ui">#{order.order_number}</p>
          <p className="mt-2 text-sm text-muted-foreground">Placed {placed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
          {order.status === "new" && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-700">
              <BellRing className="h-3 w-3 animate-pulse" /> Waiting for café to accept
            </p>
          )}
          {(order.status === "accepted" || order.status === "preparing" || order.status === "ready") && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs">
              <Clock className="h-3 w-3" /> Estimated ~{minutes} min
            </p>
          )}
          <p className="mt-5 rounded-2xl bg-primary/10 p-3 text-sm text-foreground">
            Please remain seated. Our staff will bring your order to your table.
          </p>
        </section>

        <section className="rounded-3xl bg-card p-6 shadow-card">
          <h2 className="mb-4 font-display text-lg">Progress</h2>
          <ol className="grid grid-cols-5 gap-2">
            {STEPS.map((s, idx) => {
              const done = idx <= stepIdx;
              const current = idx === stepIdx;
              return (
                <li key={s.key} className="flex flex-col items-center text-center">
                  <div className={cn("grid h-10 w-10 place-items-center rounded-full ring-2 transition-smooth", done ? "bg-primary text-primary-foreground ring-primary" : "bg-secondary text-muted-foreground ring-border", current && "animate-pulse")}>
                    <s.Icon className="h-4 w-4" />
                  </div>
                  <p className={cn("mt-2 text-[10px] font-semibold uppercase tracking-widest", done ? "text-foreground" : "text-muted-foreground")}>{s.label}</p>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="rounded-3xl bg-card p-6 shadow-card">
          <h2 className="mb-4 font-display text-lg">Your items</h2>
          <ul className="divide-y divide-border">
            {items.map((it) => (
              <li key={it.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium font-ui">{it.quantity}× {it.name}</p>
                  {it.special_instructions && <p className="mt-0.5 text-xs italic text-muted-foreground">"{it.special_instructions}"</p>}
                </div>
                <p className="text-sm font-semibold font-ui">₹{Number(it.line_total).toFixed(2)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 border-t border-border pt-4 text-sm font-ui">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>₹{Number(order.subtotal).toFixed(2)}</dd></div>
            <div className="flex justify-between text-muted-foreground"><dt>CGST (2.5%)</dt><dd>₹{Number(order.cgst_amount).toFixed(2)}</dd></div>
            <div className="flex justify-between text-muted-foreground"><dt>SGST (2.5%)</dt><dd>₹{Number(order.sgst_amount).toFixed(2)}</dd></div>
            <div className="flex justify-between border-t border-border pt-2 font-display text-xl"><dt>Total</dt><dd>₹{Number(order.total).toFixed(2)}</dd></div>
          </dl>
        </section>

        {table && (
          <div className="text-center">
            <Link to="/order" search={{ table }}>
              <Button variant="outline" className="rounded-full">Order more items</Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
