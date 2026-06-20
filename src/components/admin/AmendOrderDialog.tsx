import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Minus, Plus, Search, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ActorRole, MenuItem, OrderItem } from "@/lib/menu-types";
import { addItem, changeItemQuantity, removeItem, setOrderNote } from "@/lib/order-ops";
import { AmendmentHistory } from "./AmendmentHistory";

type Props = {
  orderId: string;
  orderNumber: string;
  role: ActorRole;
  initialNote: string | null;
  /** Hide pricing controls (kitchen). */
  hidePrices?: boolean;
  /** Custom trigger button. */
  trigger?: React.ReactNode;
};

export function AmendOrderDialog({ orderId, orderNumber, role, initialNote, hidePrices = false, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [note, setNote] = useState(initialNote ?? "");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    const [it, mn] = await Promise.all([
      supabase.from("order_items").select("*").eq("order_id", orderId).order("created_at"),
      supabase.from("menu_items").select("*").eq("available", true).order("name"),
    ]);
    setItems((it.data ?? []) as OrderItem[]);
    setMenu((mn.data ?? []) as MenuItem[]);
    setLoading(false);
  }

  useEffect(() => {
    if (!open) return;
    refresh();
    const ch = supabase
      .channel(`amend-dlg-${orderId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items", filter: `order_id=eq.${orderId}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId]);

  useEffect(() => { setNote(initialNote ?? ""); }, [initialNote]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return menu.slice(0, 12);
    return menu.filter((m) => m.name.toLowerCase().includes(q) || (m.sku ?? "").toLowerCase().includes(q)).slice(0, 12);
  }, [menu, query]);

  async function onQty(it: OrderItem, q: number) {
    try { await changeItemQuantity(orderId, it, q, role); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function onRemove(it: OrderItem) {
    try { await removeItem(orderId, it, role); toast.success(`Removed ${it.name}`); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function onAdd(m: MenuItem) {
    try { await addItem(orderId, { id: m.id, name: m.name, sku: m.sku, price: Number(m.price) }, 1, role); toast.success(`Added ${m.name}`); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function onSaveNote() {
    try { await setOrderNote(orderId, note, role); toast.success("Note saved"); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button size="sm" variant="outline" className="h-8 rounded-full text-xs">Amend</Button>}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Amend Order <span className="font-ui">#{orderNumber}</span>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-5">
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Current Items</h3>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No items in this order.</p>
              ) : (
                <ul className="space-y-2">
                  {items.map((it) => (
                    <li key={it.id} className="flex items-center gap-2 rounded-xl bg-secondary p-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium font-ui">{it.name}</p>
                        {!hidePrices && (
                          <p className="font-ui text-[11px] text-muted-foreground">₹{Number(it.unit_price).toFixed(0)} × {it.quantity} = ₹{Number(it.line_total).toFixed(0)}</p>
                        )}
                        {it.special_instructions && <p className="text-[11px] italic text-muted-foreground">"{it.special_instructions}"</p>}
                      </div>
                      <div className="flex items-center gap-1 rounded-full bg-card p-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={() => onQty(it, it.quantity - 1)} aria-label="Decrease">
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <span className="min-w-[1.5rem] text-center font-ui text-sm font-bold">{it.quantity}</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={() => onQty(it, it.quantity + 1)} aria-label="Increase">
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10" onClick={() => onRemove(it)} aria-label="Remove">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Add Items</h3>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search menu…" className="h-9 rounded-xl pl-9" />
              </div>
              <div className="mt-2 grid max-h-56 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
                {filtered.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => onAdd(m)}
                    className="flex items-center justify-between gap-2 rounded-xl bg-card p-2 text-left shadow-card transition hover:bg-accent"
                  >
                    <span className="min-w-0 truncate text-sm">{m.name}</span>
                    <span className="flex items-center gap-1.5">
                      {!hidePrices && <span className="font-ui text-xs text-muted-foreground">₹{Number(m.price).toFixed(0)}</span>}
                      <Plus className="h-3.5 w-3.5 text-primary" />
                    </span>
                  </button>
                ))}
                {filtered.length === 0 && <p className="col-span-full py-4 text-center text-xs text-muted-foreground">No matches.</p>}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Order Note</h3>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="min-h-[72px] text-sm" placeholder="Note for the kitchen…" />
              <Button size="sm" variant="outline" className="mt-2 rounded-full" onClick={onSaveNote}>Save note</Button>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Amendment History</h3>
              <AmendmentHistory orderId={orderId} />
            </section>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" className="rounded-full" onClick={() => setOpen(false)}>
            <X className="mr-1 h-4 w-4" /> Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
