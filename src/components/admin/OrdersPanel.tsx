import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

type OrderRow = {
  id: string;
  order_number: string;
  order_date: string;
  table_number: number;
  status: string;
  subtotal: number;
  gst_amount: number;
  total: number;
  notes: string | null;
  created_at: string;
};

type OrderItem = {
  id: string;
  order_id: string;
  name: string;
  sku: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  special_instructions: string | null;
};

const STATUSES = ["all", "received", "preparing", "ready", "served", "cancelled"] as const;

export function OrdersPanel() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [items, setItems] = useState<Record<string, OrderItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("all");
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    let q = supabase.from("orders").select("*").eq("order_date", date).order("created_at", { ascending: false });
    if (status !== "all") q = q.eq("status", status);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setOrders((data ?? []) as OrderRow[]);
    setLoading(false);
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [status, date]);

  async function loadItems(orderId: string) {
    if (items[orderId]) return;
    const { data } = await supabase.from("order_items").select("*").eq("order_id", orderId);
    setItems((prev) => ({ ...prev, [orderId]: (data ?? []) as OrderItem[] }));
  }

  async function setOrderStatus(o: OrderRow, next: string) {
    const { error } = await supabase.from("orders").update({ status: next }).eq("id", o.id);
    if (error) toast.error(error.message);
    else { toast.success(`Order #${o.order_number} → ${next}`); refresh(); }
  }

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return orders;
    return orders.filter((o) =>
      o.order_number.toLowerCase().includes(s) ||
      String(o.table_number).includes(s),
    );
  }, [orders, search]);

  function exportCSV() {
    const rows = [
      ["Order #", "Date", "Time", "Table", "Status", "Subtotal", "GST", "Total", "Notes"],
      ...filtered.map((o) => [
        o.order_number, o.order_date, new Date(o.created_at).toLocaleTimeString(),
        o.table_number, o.status, o.subtotal, o.gst_amount, o.total, (o.notes ?? "").replace(/\n/g, " "),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `orders-${date}.csv`;
    a.click();
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-end gap-3 rounded-2xl p-4 shadow-card">
        <div>
          <label className="text-xs text-muted-foreground">Date</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 h-9 w-44" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Status</label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="mt-1 h-9 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="text-xs text-muted-foreground">Search</label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order # or table" className="mt-1 h-9" />
        </div>
        <Button variant="outline" onClick={exportCSV} className="h-9 rounded-full"><Download className="mr-1.5 h-4 w-4" /> CSV</Button>
      </Card>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground">No orders for these filters.</Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => {
            const isOpen = expanded === o.id;
            return (
              <Card key={o.id} className="rounded-2xl p-4 shadow-card">
                <button
                  className="flex w-full items-center justify-between gap-3 text-left"
                  onClick={() => { setExpanded(isOpen ? null : o.id); if (!isOpen) loadItems(o.id); }}
                >
                  <div className="min-w-0">
                    <p className="font-display text-lg">#{o.order_number} <span className="text-sm text-muted-foreground">· Table {o.table_number}</span></p>
                    <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleTimeString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={o.status === "served" ? "secondary" : o.status === "cancelled" ? "destructive" : "default"}>{o.status}</Badge>
                    <p className="font-display text-lg">₹{Number(o.total).toFixed(0)}</p>
                  </div>
                </button>

                {isOpen && (
                  <div className="mt-3 space-y-3 border-t border-border pt-3">
                    <div className="space-y-1 text-sm">
                      {(items[o.id] ?? []).map((it) => (
                        <div key={it.id} className="flex justify-between gap-2">
                          <span className="truncate">{it.quantity}× {it.name}{it.sku ? <span className="text-muted-foreground"> · {it.sku}</span> : null}</span>
                          <span>₹{Number(it.line_total).toFixed(0)}</span>
                        </div>
                      ))}
                      {!items[o.id] && <p className="text-xs text-muted-foreground">Loading items…</p>}
                    </div>
                    {o.notes && <p className="rounded-lg bg-muted p-2 text-xs">Note: {o.notes}</p>}
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      <span className="text-muted-foreground">Subtotal ₹{Number(o.subtotal).toFixed(0)} · GST ₹{Number(o.gst_amount).toFixed(0)}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {["received", "preparing", "ready", "served"].map((s) => (
                        <Button key={s} size="sm" variant={o.status === s ? "default" : "outline"} className="h-8 rounded-full text-xs"
                          onClick={() => setOrderStatus(o, s)}>{s}</Button>
                      ))}
                      <Button size="sm" variant="ghost" className="h-8 rounded-full text-xs text-destructive hover:bg-destructive/10"
                        onClick={() => setOrderStatus(o, "cancelled")}>Cancel</Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
