import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Minus, Plus, ShoppingCart, Trash2, X, Loader2, MessageSquare, ImageOff, Sparkles, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { CafeTable, Category, MenuItem } from "@/lib/menu-types";
import { useCart, selectCart, cartTotals, lineTotals, type CartLine } from "@/lib/cart-store";
import { buildCoOccurrence, recommend, type CoOccurrence } from "@/lib/recommendations";
import { evaluatePromotions, type Promotion, type PromotionSuggestion } from "@/lib/promotions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const searchSchema = z.object({ table: z.coerce.number().int().positive().optional() });

export const Route = createFileRoute("/order")({
  validateSearch: searchSchema,
  component: OrderPage,
  head: () => ({ meta: [{ title: "BrownSugar Café — Order" }, { name: "description", content: "Place your BrownSugar Café dine-in order from your table." }, { name: "robots", content: "noindex, nofollow" }] }),
});

function OrderPage() {
  const { table: tableNum } = Route.useSearch();
  const navigate = useNavigate();
  const tableKey = String(tableNum ?? "");
  const [table, setTable] = useState<CafeTable | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [coOccurrence, setCoOccurrence] = useState<CoOccurrence>(new Map());
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<string | "all">("all");
  const [query, setQuery] = useState("");
  const [cartOpen, setCartOpen] = useState(false);

  const cart = useCart(selectCart(tableKey));
  const add = useCart((s) => s.add);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!tableNum) { setLoading(false); return; }
      const sinceISO = new Date(Date.now() - 30 * 86400_000).toISOString();
      const [t, c, i, p, oi] = await Promise.all([
        supabase.from("tables").select("*").eq("table_number", tableNum).maybeSingle(),
        supabase.from("categories").select("*").order("sort_order"),
        supabase.from("menu_items").select("*").order("sort_order"),
        supabase.from("promotions" as never).select("*").eq("active", true),
        supabase.from("order_items").select("order_id, menu_item_id").gte("created_at", sinceISO).limit(2000),
      ]);
      if (!mounted) return;
      setTable((t.data as CafeTable | null) ?? null);
      setCategories((c.data ?? []) as Category[]);
      setItems((i.data ?? []) as MenuItem[]);
      setPromotions((((p as { data?: Promotion[] }).data ?? []) as Promotion[]));
      setCoOccurrence(buildCoOccurrence(((oi.data ?? []) as Array<{ order_id: string; menu_item_id: string | null }>)));
      setLoading(false);
    })();
    const ch = supabase
      .channel("order-menu")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, async () => {
        const { data } = await supabase.from("menu_items").select("*").order("sort_order");
        setItems((data ?? []) as MenuItem[]);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "promotions" }, async () => {
        const { data } = await supabase.from("promotions" as never).select("*").eq("active", true);
        setPromotions((((data as unknown) as Promotion[]) ?? []) as Promotion[]);
      })
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [tableNum]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (activeCat !== "all" && it.category_id !== activeCat) return false;
      if (query && !it.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [items, activeCat, query]);

  if (!tableNum) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-hero p-6 text-center">
        <div className="max-w-md rounded-3xl bg-card p-8 shadow-elegant">
          <h1 className="font-display text-2xl">Scan your table QR</h1>
          <p className="mt-2 text-sm text-muted-foreground">To order, scan the QR code at your table.</p>
          <Link to="/" className="mt-5 inline-block text-sm text-primary underline">View menu only</Link>
        </div>
      </div>
    );
  }
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (!table) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-hero p-6 text-center">
        <div className="max-w-md rounded-3xl bg-card p-8 shadow-elegant">
          <h1 className="font-display text-2xl">Table not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This QR doesn't match a table in our system.</p>
        </div>
      </div>
    );
  }
  if (!table.active) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-hero p-6 text-center">
        <div className="max-w-md rounded-3xl bg-card p-8 shadow-elegant">
          <h1 className="font-display text-2xl">Table unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">{table.name} is not accepting orders right now. Please ask our staff for help.</p>
        </div>
      </div>
    );
  }

  // (totals are computed inside CartSheet for order insert; not surfaced in customer UI)
  const cartCount = cart.reduce((n, l) => n + l.quantity, 0);

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">Now serving</p>
            <h1 className="font-display text-2xl leading-tight">{table.name}</h1>
          </div>
          <Sheet open={cartOpen} onOpenChange={setCartOpen}>
            <SheetTrigger asChild>
              <Button className="relative rounded-full bg-primary text-primary-foreground hover:opacity-90">
                <ShoppingCart className="mr-2 h-4 w-4" />
                Cart
                {cartCount > 0 && (
                  <span className="ml-2 rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs font-ui font-semibold">{cartCount}</span>
                )}
              </Button>
            </SheetTrigger>
            <CartSheet
              table={tableKey}
              tableNumberInt={tableNum}
              tableId={table.id}
              menuItems={items}
              promotions={promotions}
              coOccurrence={coOccurrence}
              onPlaced={(id) => { setCartOpen(false); navigate({ to: "/order-status/$orderId", params: { orderId: id }, search: { table: tableNum } }); }}
            />
          </Sheet>
        </div>
        <div className="mx-auto max-w-3xl overflow-x-auto px-4 pb-3">
          <div className="flex gap-2">
            <button onClick={() => setActiveCat("all")} className={cn("shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold", activeCat === "all" ? "bg-foreground text-background" : "bg-secondary")}>All</button>
            {categories.map((c) => (
              <button key={c.id} onClick={() => setActiveCat(c.id)} className={cn("shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold", activeCat === c.id ? "bg-foreground text-background" : "bg-secondary")}>
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-4">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search menu..." className="h-11 rounded-2xl" />

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {filtered.map((item) => {
            const line = cart.find((l) => l.menu_item_id === item.id);
            const disabled = !item.available;
            return (
              <div key={item.id} className={cn("flex gap-3 rounded-2xl bg-card p-3 shadow-card transition-smooth", disabled && "opacity-60")}>
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {item.image_url ? <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><ImageOff className="h-5 w-5 text-muted-foreground" /></div>}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start gap-2">
                    <span className={cn("mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-background", item.veg_type === "veg" ? "bg-emerald-500" : "bg-rose-500")} />
                    <p className="flex-1 truncate font-medium leading-tight">{item.name}</p>
                  </div>
                  {item.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>}
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <div>
                      <p className="text-sm font-semibold font-ui">₹{Number(item.price).toFixed(0)}</p>
                    </div>
                    {disabled ? (
                      <span className="rounded-full bg-destructive/10 px-3 py-1 text-[10px] font-semibold uppercase text-destructive">Sold out</span>
                    ) : line ? (
                      <QtyStepper qty={line.quantity} onChange={(q) => useCart.getState().setQty(tableKey, item.id, q)} />
                    ) : (
                      <Button size="sm" onClick={() => add(tableKey, { menu_item_id: item.id, name: item.name, sku: item.sku, unit_price: Number(item.price), gst_percentage: Number(item.gst_percentage), image_url: item.image_url })} className="h-8 rounded-full bg-primary text-primary-foreground hover:opacity-90">
                        <Plus className="h-3.5 w-3.5" /> Add
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {filtered.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No items match.</p>}
      </main>

      {cartCount > 0 && !cartOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-ui">Your selection</p>
              <p className="font-ui text-xl font-bold">{cartCount} item{cartCount > 1 ? "s" : ""}</p>
            </div>
            <Button onClick={() => setCartOpen(true)} className="rounded-full bg-primary px-6 text-primary-foreground hover:opacity-90">Review order</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function QtyStepper({ qty, onChange }: { qty: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-secondary p-1">
      <button onClick={() => onChange(qty - 1)} className="grid h-7 w-7 place-items-center rounded-full bg-card text-foreground shadow-soft"><Minus className="h-3.5 w-3.5" /></button>
      <span className="min-w-[1.5rem] text-center text-sm font-bold font-ui">{qty}</span>
      <button onClick={() => onChange(qty + 1)} className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground shadow-soft"><Plus className="h-3.5 w-3.5" /></button>
    </div>
  );
}

function CartSheet({ table, tableNumberInt, tableId, onPlaced }: { table: string; tableNumberInt: number; tableId: string; onPlaced: (orderId: string) => void }) {
  const cart = useCart(selectCart(table));
  const setQty = useCart((s) => s.setQty);
  const setInstructions = useCart((s) => s.setInstructions);
  const remove = useCart((s) => s.remove);
  const clear = useCart((s) => s.clear);
  const setLastOrder = useCart((s) => s.setLastOrder);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const t = cartTotals(cart);

  async function place() {
    if (cart.length === 0) return;
    setBusy(true);
    try {
      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          table_id: tableId,
          table_number: tableNumberInt,
          subtotal: t.subtotal,
          gst_amount: t.gst,
          cgst_amount: t.cgst,
          sgst_amount: t.sgst,
          total: t.total,
          notes: notes || null,
          status: "new",
          order_number: "",
          daily_seq: 0,
        })
        .select()
        .single();
      if (error) throw error;
      const itemsPayload = cart.map((l) => {
        const lt = lineTotals(l);
        return {
          order_id: order.id,
          menu_item_id: l.menu_item_id,
          name: l.name,
          sku: l.sku,
          unit_price: l.unit_price,
          gst_percentage: l.gst_percentage,
          quantity: l.quantity,
          special_instructions: l.special_instructions || null,
          line_subtotal: lt.subtotal,
          line_gst: lt.gst,
          line_cgst: lt.cgst,
          line_sgst: lt.sgst,
          line_total: lt.total,
        };
      });
      const { error: ie } = await supabase.from("order_items").insert(itemsPayload);
      if (ie) throw ie;
      setLastOrder(table, order.id);
      clear(table);
      toast.success(`Order #${order.order_number} placed!`);
      onPlaced(order.id);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
      <SheetHeader>
        <SheetTitle className="font-display text-2xl">Your order</SheetTitle>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto py-4">
        {cart.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Your cart is empty.</p>
        ) : (
          <div className="space-y-3">
            {cart.map((l) => (
              <div key={l.menu_item_id} className="rounded-2xl bg-secondary p-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{l.name}</p>
                    <p className="text-xs text-muted-foreground font-ui">Qty {l.quantity}</p>
                  </div>
                  <button onClick={() => remove(table, l.menu_item_id)} className="text-muted-foreground hover:text-destructive" aria-label="Remove item"><X className="h-4 w-4" /></button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <QtyStepper qty={l.quantity} onChange={(q) => setQty(table, l.menu_item_id, q)} />
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-primary"><MessageSquare className="inline h-3 w-3" /> instructions</summary>
                    <Textarea value={l.special_instructions ?? ""} onChange={(e) => setInstructions(table, l.menu_item_id, e.target.value)} placeholder="e.g. less spicy, no onion" className="mt-2 min-h-[60px] text-xs" maxLength={200} />
                  </details>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {cart.length > 0 && (
        <div className="border-t border-border pt-4">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes for the kitchen (optional)" className="mb-3 min-h-[60px] text-sm" maxLength={300} />
          <div className="flex items-baseline justify-between rounded-2xl bg-secondary/60 px-4 py-3">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Total items</span>
            <span className="font-ui text-2xl font-bold">{cart.reduce((n, l) => n + l.quantity, 0)}</span>
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => clear(table)} className="rounded-full"><Trash2 className="mr-1 h-4 w-4" /> Clear</Button>
            <Button onClick={place} disabled={busy} className="flex-1 rounded-full bg-primary text-primary-foreground hover:opacity-90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Place Order`}
            </Button>
          </div>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">Pay at the counter after your meal.</p>
        </div>
      )}
    </SheetContent>
  );
}
