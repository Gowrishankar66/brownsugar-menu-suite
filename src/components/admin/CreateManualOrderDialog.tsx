import { useEffect, useMemo, useState } from "react";
import { Plus, Minus, X, Loader2, ClipboardEdit, Search } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { gstFromSubtotal, recomputeLine } from "@/lib/gst";

type MenuItemRow = {
  id: string; name: string; sku: string | null;
  price: number; category_id: string | null; available: boolean;
};
type TableRow = { id: string; table_number: number; name: string | null; active: boolean };
type Line = { menu_item_id: string; name: string; sku: string | null; unit_price: number; quantity: number; special_instructions?: string };

export function CreateManualOrderDialog({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [items, setItems] = useState<MenuItemRow[]>([]);
  const [tableId, setTableId] = useState<string>("");
  const [lines, setLines] = useState<Line[]>([]);
  const [notes, setNotes] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  async function loadTables() {
    const { data } = await supabase
      .from("tables")
      .select("id, table_number, name, active")
      .eq("active", true)
      .order("table_number");
    setTables(((data ?? []) as unknown) as TableRow[]);
  }

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      const m = await supabase
        .from("menu_items")
        .select("id, name, sku, price, category_id, available")
        .order("sort_order");
      setItems(((m.data ?? []) as unknown) as MenuItemRow[]);
      await loadTables();
      setLoading(false);
    })();

    // Stay in sync with Tables & QR module
    const ch = supabase
      .channel("manual-order-tables")
      .on("postgres_changes", { event: "*", schema: "public", table: "tables" }, () => { loadTables(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [open]);

  function reset() {
    setTableId(""); setLines([]); setNotes(""); setQ("");
  }

  function addItem(it: MenuItemRow) {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.menu_item_id === it.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { menu_item_id: it.id, name: it.name, sku: it.sku, unit_price: Number(it.price), quantity: 1 }];
    });
  }
  function setQty(id: string, qty: number) {
    setLines((prev) => qty <= 0
      ? prev.filter((l) => l.menu_item_id !== id)
      : prev.map((l) => l.menu_item_id === id ? { ...l, quantity: Math.min(99, qty) } : l));
  }
  function setInstr(id: string, v: string) {
    setLines((prev) => prev.map((l) => l.menu_item_id === id ? { ...l, special_instructions: v } : l));
  }
  function remove(id: string) { setLines((prev) => prev.filter((l) => l.menu_item_id !== id)); }

  const totals = useMemo(() => {
    const subtotal = lines.reduce((n, l) => n + l.unit_price * l.quantity, 0);
    return { subtotal, ...gstFromSubtotal(subtotal) };
  }, [lines]);

  const filteredMenu = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = items.filter((i) => i.available);
    if (!s) return base;
    return base.filter((i) => i.name.toLowerCase().includes(s) || (i.sku ?? "").toLowerCase().includes(s));
  }, [items, q]);

  async function create() {
    if (!tableId) { toast.error("Select a table"); return; }
    const tbl = tables.find((t) => t.id === tableId);
    if (!tbl) { toast.error("Table not found"); return; }
    if (lines.length === 0) { toast.error("Add at least one item"); return; }
    setBusy(true);
    try {
      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          table_id: tableId,
          table_number: tbl.table_number,
          subtotal: totals.subtotal,
          gst_amount: totals.gst,
          cgst_amount: totals.cgst,
          sgst_amount: totals.sgst,
          total: totals.total,
          notes: notes || null,
          status: "accepted",
          source: "manual",
          accepted_at: new Date().toISOString(),
          order_number: "",
          daily_seq: 0,
        } as never)
        .select()
        .single();
      if (error) throw error;
      const payload = lines.map((l) => {
        const lt = recomputeLine(l.unit_price, l.quantity);
        return {
          order_id: (order as { id: string }).id,
          menu_item_id: l.menu_item_id,
          name: l.name,
          sku: l.sku,
          unit_price: l.unit_price,
          gst_percentage: 5,
          quantity: l.quantity,
          special_instructions: l.special_instructions || null,
          ...lt,
        };
      });
      const { error: ie } = await supabase.from("order_items").insert(payload);
      if (ie) throw ie;
      // Log amendment so kitchen sees source clearly
      await supabase.from("order_amendments").insert({
        order_id: (order as { id: string }).id,
        actor_role: "admin",
        action: "status_changed",
        details: { source: "manual", to: "accepted", note: "Manual order created by admin" },
      } as never);
      toast.success(`Manual order #${(order as { order_number: string }).order_number} created`);
      setOpen(false);
      reset();
      onCreated?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button className="h-9 rounded-full"><ClipboardEdit className="mr-1.5 h-4 w-4" /> Manual Order</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display">Create Manual Order</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          {/* LEFT: Picker */}
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Table</label>
              <Select value={tableId} onValueChange={setTableId}>
                <SelectTrigger className="mt-1 h-9 rounded-xl"><SelectValue placeholder="Select table" /></SelectTrigger>
                <SelectContent>
                  {tables.map((t) => (
                    <SelectItem key={t.id} value={t.id}>Table {t.table_number}{t.name ? ` · ${t.name}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Menu</label>
              <div className="mt-1 flex items-center gap-2">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items" className="h-9" />
              </div>
              <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-border">
                {loading ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>
                ) : filteredMenu.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">No items</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {filteredMenu.map((it) => (
                      <li key={it.id} className="flex items-center justify-between gap-2 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{it.name}</p>
                          <p className="text-[11px] text-muted-foreground font-ui">{it.sku ? `${it.sku} · ` : ""}₹{Number(it.price).toFixed(0)}</p>
                        </div>
                        <Button size="sm" variant="outline" className="h-7 rounded-full" onClick={() => addItem(it)}>
                          <Plus className="mr-1 h-3 w-3" /> Add
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: Cart */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <p className="text-xs text-muted-foreground">Order items</p>
              <Badge variant="outline" className="rounded-full">{lines.reduce((n, l) => n + l.quantity, 0)} items</Badge>
            </div>
            <div className="max-h-56 overflow-y-auto rounded-xl border border-border p-2">
              {lines.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">No items added yet</p>
              ) : (
                <ul className="space-y-2">
                  {lines.map((l) => (
                    <li key={l.menu_item_id} className="rounded-lg bg-secondary/60 p-2">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{l.name}</p>
                          <p className="text-[11px] text-muted-foreground font-ui">₹{l.unit_price.toFixed(0)} × {l.quantity} = ₹{(l.unit_price * l.quantity).toFixed(0)}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="outline" className="h-6 w-6 rounded-full" onClick={() => setQty(l.menu_item_id, l.quantity - 1)}><Minus className="h-3 w-3" /></Button>
                          <span className="w-6 text-center text-xs font-ui">{l.quantity}</span>
                          <Button size="icon" variant="outline" className="h-6 w-6 rounded-full" onClick={() => setQty(l.menu_item_id, l.quantity + 1)}><Plus className="h-3 w-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full text-muted-foreground hover:text-destructive" onClick={() => remove(l.menu_item_id)}><X className="h-3 w-3" /></Button>
                        </div>
                      </div>
                      <Input
                        value={l.special_instructions ?? ""}
                        onChange={(e) => setInstr(l.menu_item_id, e.target.value)}
                        placeholder="Special note (optional)"
                        className="mt-1 h-7 text-xs"
                        maxLength={200}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Order notes</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Allergy: nuts" className="mt-1 min-h-[60px] text-sm" maxLength={300} />
            </div>

            <div className="rounded-xl bg-secondary/60 p-3 text-sm font-ui">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>₹{totals.subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>CGST 2.5%</span><span>₹{totals.cgst.toFixed(2)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>SGST 2.5%</span><span>₹{totals.sgst.toFixed(2)}</span></div>
              <div className="mt-1 flex justify-between border-t border-border pt-1 font-semibold"><span>Total</span><span>₹{totals.total.toFixed(2)}</span></div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} className="rounded-full">Cancel</Button>
          <Button onClick={create} disabled={busy || lines.length === 0 || !tableId} className="rounded-full">
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Create order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
