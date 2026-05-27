import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Loader2, TrendingUp, ShoppingBag, Receipt, Clock } from "lucide-react";

type OrderRow = {
  id: string;
  order_date: string;
  status: string;
  subtotal: number;
  gst_amount: number;
  total: number;
  created_at: string;
  table_number: number;
};

type OrderItem = {
  order_id: string;
  name: string;
  quantity: number;
  line_total: number;
};

function rangeStartISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function AnalyticsPanel() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const since = rangeStartISO(days);
      const [oRes, iRes] = await Promise.all([
        supabase.from("orders").select("*").gte("order_date", since).neq("status", "cancelled"),
        supabase.from("order_items").select("order_id,name,quantity,line_total"),
      ]);
      if (cancelled) return;
      const os = (oRes.data ?? []) as OrderRow[];
      const ids = new Set(os.map((o) => o.id));
      setOrders(os);
      setItems(((iRes.data ?? []) as OrderItem[]).filter((it) => ids.has(it.order_id)));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [days]);

  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter((o) => o.order_date === today);

  const totals = useMemo(() => {
    const rev = orders.reduce((s, o) => s + Number(o.total), 0);
    const todayRev = todayOrders.reduce((s, o) => s + Number(o.total), 0);
    const avg = orders.length ? rev / orders.length : 0;
    return { rev, todayRev, avg, count: orders.length, todayCount: todayOrders.length };
  }, [orders, todayOrders]);

  const topItems = useMemo(() => {
    const m = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const it of items) {
      const e = m.get(it.name) ?? { name: it.name, qty: 0, revenue: 0 };
      e.qty += Number(it.quantity);
      e.revenue += Number(it.line_total);
      m.set(it.name, e);
    }
    return [...m.values()].sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [items]);

  const peakHours = useMemo(() => {
    const buckets = new Array(24).fill(0);
    for (const o of orders) buckets[new Date(o.created_at).getHours()]++;
    const max = Math.max(...buckets, 1);
    return buckets.map((c, h) => ({ hour: h, count: c, pct: (c / max) * 100 }));
  }, [orders]);

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Showing last {days} days</p>
        <div className="flex gap-1">
          {[1, 7, 30].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`rounded-full border px-3 py-1 text-xs ${days === d ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>
              {d === 1 ? "Today" : `${d}d`}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Receipt className="h-4 w-4" />} label="Revenue (Today)" value={`₹${totals.todayRev.toFixed(0)}`} />
        <Stat icon={<TrendingUp className="h-4 w-4" />} label={`Revenue (${days}d)`} value={`₹${totals.rev.toFixed(0)}`} />
        <Stat icon={<ShoppingBag className="h-4 w-4" />} label="Orders Today" value={String(totals.todayCount)} />
        <Stat icon={<Clock className="h-4 w-4" />} label="Avg Order Value" value={`₹${totals.avg.toFixed(0)}`} />
      </div>

      <Card className="rounded-2xl p-5 shadow-card">
        <h3 className="font-display text-lg">Top Selling Items</h3>
        {topItems.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {topItems.map((t) => (
              <div key={t.name} className="flex items-center gap-3">
                <span className="w-40 truncate text-sm">{t.name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(t.qty / topItems[0].qty) * 100}%` }} />
                </div>
                <span className="w-16 text-right text-sm tabular-nums">{t.qty} sold</span>
                <span className="w-20 text-right text-sm tabular-nums text-muted-foreground">₹{t.revenue.toFixed(0)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="rounded-2xl p-5 shadow-card">
        <h3 className="font-display text-lg">Peak Hours</h3>
        <p className="text-xs text-muted-foreground">Orders by hour of day (last {days}d)</p>
        <div className="mt-4 flex h-32 items-end gap-1">
          {peakHours.map((h) => (
            <div key={h.hour} className="flex flex-1 flex-col items-center gap-1">
              <div className="w-full rounded-t bg-primary/80" style={{ height: `${h.pct}%`, minHeight: h.count ? 4 : 0 }} title={`${h.count} orders`} />
              <span className="text-[9px] text-muted-foreground">{h.hour}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="rounded-2xl p-4 shadow-card">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {icon}{label}
      </div>
      <p className="mt-1 font-display text-3xl">{value}</p>
    </Card>
  );
}
