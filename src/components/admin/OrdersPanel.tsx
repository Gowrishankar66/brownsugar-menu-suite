import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, Printer, CheckCircle2, IndianRupee, RotateCcw, BellRing, Pencil } from "lucide-react";
import { toast } from "sonner";
import { printBill, type BillItem } from "@/lib/print-bill";
import { setOrderStatus as setStatusOp } from "@/lib/order-ops";
import { AmendOrderDialog } from "./AmendOrderDialog";
import { AmendmentHistory } from "./AmendmentHistory";
import { CreateManualOrderDialog } from "./CreateManualOrderDialog";
import { startRinging, stopRinging, loadNotifySettings, playNotify } from "@/lib/notify-sound";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/lib/menu-types";

type OrderRow = {
  id: string;
  order_number: string;
  order_date: string;
  table_number: number;
  status: OrderStatus;
  source?: "qr" | "manual" | null;
  subtotal: number;
  gst_amount: number;
  cgst_amount: number;
  sgst_amount: number;
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
  line_subtotal: number;
  line_total: number;
  special_instructions: string | null;
};

const STATUSES: ReadonlyArray<"all" | OrderStatus> = [
  "all", "new", "accepted", "preparing", "ready", "served", "completed", "cancelled",
];
const FLOW: OrderStatus[] = ["new", "accepted", "preparing", "ready", "served", "completed"];
const PAID_KEY = "bs.paid.v1";

function loadPaid(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(window.localStorage.getItem(PAID_KEY) ?? "{}"); } catch { return {}; }
}
function savePaid(p: Record<string, boolean>) {
  try { window.localStorage.setItem(PAID_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

const STATUS_TONE: Record<OrderStatus, string> = {
  new: "bg-rose-500 text-white animate-pulse",
  accepted: "bg-blue-500/10 text-blue-700 border border-blue-500/30",
  preparing: "bg-amber-500/10 text-amber-700 border border-amber-500/30",
  ready: "bg-emerald-500/10 text-emerald-700 border border-emerald-500/30",
  served: "bg-secondary text-foreground border border-border",
  completed: "bg-muted text-muted-foreground border border-border",
  cancelled: "bg-destructive/10 text-destructive border border-destructive/30",
};

export function OrdersPanel() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [items, setItems] = useState<Record<string, OrderItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("all");
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [paid, setPaid] = useState<Record<string, boolean>>(() => loadPaid());

  async function refresh() {
    setLoading(true);
    let q = supabase.from("orders").select("*").eq("order_date", date).order("created_at", { ascending: false });
    if (status !== "all") q = q.eq("status", status);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setOrders((data ?? []) as unknown as OrderRow[]);
    setLoading(false);
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [status, date]);

  // Live updates + continuous-ring management.
  useEffect(() => {
    const ch = supabase
      .channel("admin-orders-panel")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (p) => {
        if (p.eventType === "INSERT") playNotify("new");
        if (p.eventType === "UPDATE" && (p.new as { status?: string }).status === "cancelled") playNotify("cancelled");
        refresh();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_items" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [date, status]);

  // Continuous ring while any 'new' order exists today.
  useEffect(() => {
    const s = loadNotifySettings();
    const hasNew = orders.some((o) => o.status === "new");
    if (s.enabled && s.mode === "continuous" && hasNew) startRinging(s);
    else stopRinging();
    return () => { stopRinging(); };
  }, [orders]);

  async function loadItems(orderId: string): Promise<OrderItem[]> {
    if (items[orderId]) return items[orderId];
    const { data } = await supabase.from("order_items").select("*").eq("order_id", orderId);
    const list = (data ?? []) as unknown as OrderItem[];
    setItems((prev) => ({ ...prev, [orderId]: list }));
    return list;
  }

  async function setOrderStatus(o: OrderRow, next: OrderStatus) {
    try {
      await setStatusOp(o.id, next, "admin", o.status);
      toast.success(`Order #${o.order_number} → ${next}`);
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  }

  function togglePaid(o: OrderRow) {
    const next = { ...paid, [o.id]: !paid[o.id] };
    if (!next[o.id]) delete next[o.id];
    setPaid(next);
    savePaid(next);
    toast.success(next[o.id] ? `Marked paid: #${o.order_number}` : `Marked unpaid: #${o.order_number}`);
  }

  async function handlePrint(o: OrderRow) {
    const list = await loadItems(o.id);
    const billItems: BillItem[] = list.map((it) => ({
      name: it.name, sku: it.sku, quantity: it.quantity,
      unit_price: Number(it.unit_price),
      line_subtotal: Number(it.line_subtotal), line_total: Number(it.line_total),
    }));
    printBill(o, billItems, { paymentStatus: paid[o.id] ? "paid" : "unpaid" });
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
      ["Order #", "Date", "Time", "Table", "Status", "Paid", "Subtotal", "CGST", "SGST", "GST Total", "Total", "Notes"],
      ...filtered.map((o) => [
        o.order_number, o.order_date, new Date(o.created_at).toLocaleTimeString(),
        o.table_number, o.status, paid[o.id] ? "paid" : "unpaid",
        o.subtotal, o.cgst_amount, o.sgst_amount, o.gst_amount, o.total, (o.notes ?? "").replace(/\n/g, " "),
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
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 h-9 w-44 font-ui" />
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
        <Button variant="outline" onClick={stopRinging} className="h-9 rounded-full" title="Silence ringer">
          <BellRing className="mr-1.5 h-4 w-4" /> Silence
        </Button>
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
            const isPaid = !!paid[o.id];
            const nextIdx = FLOW.indexOf(o.status);
            const nextStatus = nextIdx >= 0 && nextIdx < FLOW.length - 1 ? FLOW[nextIdx + 1] : null;
            return (
              <Card key={o.id} className={cn("rounded-2xl p-4 shadow-card", o.status === "new" && "ring-2 ring-rose-400/70")}>
                <button
                  className="flex w-full items-center justify-between gap-3 text-left"
                  onClick={() => { setExpanded(isOpen ? null : o.id); if (!isOpen) loadItems(o.id); }}
                >
                  <div className="min-w-0">
                    <p className="font-display text-lg">
                      <span className="font-ui font-semibold">#{o.order_number}</span>
                      <span className="text-sm text-muted-foreground font-ui"> · Table {o.table_number}</span>
                    </p>
                    <p className="text-xs text-muted-foreground font-ui">{new Date(o.created_at).toLocaleTimeString()}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {o.status === "new" && (
                      <Badge className="bg-rose-500 font-ui uppercase tracking-wider text-[10px] text-white">NEW ORDER</Badge>
                    )}
                    <Badge className={cn("font-ui uppercase tracking-wider text-[10px]", STATUS_TONE[o.status])}>{o.status}</Badge>
                    <Badge variant={isPaid ? "default" : "outline"} className="font-ui uppercase tracking-wider text-[10px]">{isPaid ? "paid" : "unpaid"}</Badge>
                    <p className="font-ui text-lg font-semibold">₹{Number(o.total).toFixed(0)}</p>
                  </div>
                </button>

                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
                  {o.status === "new" && (
                    <Button size="sm" className="h-8 rounded-full bg-rose-500 text-xs text-white hover:bg-rose-600" onClick={() => setOrderStatus(o, "accepted")}>
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Accept Order
                    </Button>
                  )}
                  {nextStatus && o.status !== "new" && (
                    <Button size="sm" className="h-8 rounded-full text-xs" onClick={() => setOrderStatus(o, nextStatus)}>
                      → {nextStatus}
                    </Button>
                  )}
                  <AmendOrderDialog
                    orderId={o.id}
                    orderNumber={o.order_number}
                    role="admin"
                    initialNote={o.notes}
                    trigger={<Button size="sm" variant="outline" className="h-8 rounded-full text-xs"><Pencil className="mr-1 h-3 w-3" /> Amend</Button>}
                  />
                  <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => handlePrint(o)}>
                    <Printer className="mr-1 h-3 w-3" /> Print Bill
                  </Button>
                  <Button size="sm" variant={isPaid ? "default" : "outline"} className="h-8 rounded-full text-xs" onClick={() => togglePaid(o)}>
                    <IndianRupee className="mr-1 h-3 w-3" /> {isPaid ? "Paid ✓" : "Mark Paid"}
                  </Button>
                  {(o.status === "completed" || o.status === "served" || o.status === "cancelled") && (
                    <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => setOrderStatus(o, "preparing")}>
                      <RotateCcw className="mr-1 h-3 w-3" /> Reopen
                    </Button>
                  )}
                  {o.status !== "cancelled" && o.status !== "completed" && (
                    <Button size="sm" variant="ghost" className="h-8 rounded-full text-xs text-destructive hover:bg-destructive/10" onClick={() => setOrderStatus(o, "cancelled")}>
                      Cancel
                    </Button>
                  )}
                </div>

                {isOpen && (
                  <div className="mt-3 space-y-3 border-t border-border pt-3">
                    <div className="space-y-1 text-sm">
                      {(items[o.id] ?? []).map((it) => (
                        <div key={it.id} className="flex justify-between gap-2 font-ui">
                          <span className="truncate"><span className="font-semibold">{it.quantity}×</span> {it.name}{it.sku ? <span className="text-muted-foreground"> · {it.sku}</span> : null}</span>
                          <span>₹{Number(it.line_total).toFixed(0)}</span>
                        </div>
                      ))}
                      {!items[o.id] && <p className="text-xs text-muted-foreground">Loading items…</p>}
                    </div>
                    {o.notes && <p className="rounded-lg bg-muted p-2 text-xs">Note: {o.notes}</p>}
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-ui">
                      <dt className="text-muted-foreground">Subtotal</dt><dd className="text-right">₹{Number(o.subtotal).toFixed(2)}</dd>
                      <dt className="text-muted-foreground">CGST (2.5%)</dt><dd className="text-right">₹{Number(o.cgst_amount).toFixed(2)}</dd>
                      <dt className="text-muted-foreground">SGST (2.5%)</dt><dd className="text-right">₹{Number(o.sgst_amount).toFixed(2)}</dd>
                      <dt className="border-t border-border pt-1 font-semibold">Total</dt><dd className="border-t border-border pt-1 text-right font-semibold">₹{Number(o.total).toFixed(2)}</dd>
                    </dl>
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Amendment History</p>
                      <AmendmentHistory orderId={o.id} />
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
