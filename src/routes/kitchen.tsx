import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Bell, ChefHat, Clock, LogOut, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Order, OrderItem, OrderStatus } from "@/lib/menu-types";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { playNotify } from "@/lib/notify-sound";
import { NotificationSettings } from "@/components/admin/NotificationSettings";

export const Route = createFileRoute("/kitchen")({
  component: KitchenPage,
  head: () => ({ meta: [{ title: "Kitchen — BrownSugar" }, { name: "robots", content: "noindex" }] }),
});

function KitchenPage() {
  const [session, setSession] = useState<unknown>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) check(s.user.id);
      else { setIsAdmin(false); setChecking(false); }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) check(data.session.user.id);
      else setChecking(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function check(uid: string) {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
    setIsAdmin(!!data);
    setChecking(false);
  }

  if (checking) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!session || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-center">
        <div className="max-w-md rounded-3xl bg-card p-8 shadow-elegant">
          <ChefHat className="mx-auto h-8 w-8 text-primary" />
          <h1 className="mt-3 font-display text-2xl">Kitchen Dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in as an admin to view live orders.</p>
          <a href="/admin"><Button className="mt-5 rounded-full bg-primary text-primary-foreground hover:opacity-90">Go to admin login</Button></a>
        </div>
      </div>
    );
  }
  return <Kitchen />;
}

type Sort = "oldest" | "newest" | "value";

function Kitchen() {
  const [orders, setOrders] = useState<(Order & { items: OrderItem[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<Sort>("oldest");
  const [sound, setSound] = useState(true);
  const seenIds = useRef<Set<string>>(new Set());

  async function load() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { data: os } = await supabase
      .from("orders")
      .select("*")
      .in("status", ["received", "preparing", "ready"])
      .order("created_at", { ascending: true });
    const ids = (os ?? []).map((o) => o.id);
    let its: OrderItem[] = [];
    if (ids.length) {
      const { data } = await supabase.from("order_items").select("*").in("order_id", ids);
      its = (data ?? []) as OrderItem[];
    }
    const grouped = (os ?? []).map((o) => ({ ...(o as Order), items: its.filter((i) => i.order_id === o.id) }));
    grouped.forEach((o) => seenIds.current.add(o.id));
    setOrders(grouped);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("kitchen-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, async (p) => {
        const o = p.new as Order;
        if (!seenIds.current.has(o.id)) {
          if (sound) playDing();
          toast.success(`New order #${o.order_number} — Table ${o.table_number}`);
        }
        await load();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sound]);

  const sorted = useMemo(() => {
    const a = [...orders];
    if (sort === "oldest") a.sort((x, y) => +new Date(x.created_at) - +new Date(y.created_at));
    if (sort === "newest") a.sort((x, y) => +new Date(y.created_at) - +new Date(x.created_at));
    if (sort === "value") a.sort((x, y) => Number(y.total) - Number(x.total));
    return a;
  }, [orders, sort]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-primary" />
            <div>
              <h1 className="font-display text-xl leading-tight">Kitchen</h1>
              <p className="text-[11px] text-muted-foreground">{orders.length} active order{orders.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
              <SelectTrigger className="h-9 w-[140px] rounded-full text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="value">Highest value</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => setSound((v) => !v)} className="rounded-full" title={sound ? "Mute" : "Unmute"}>
              {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
            <a href="/admin"><Button variant="outline" size="sm" className="rounded-full">Admin</Button></a>
            <Button variant="outline" size="sm" onClick={() => supabase.auth.signOut()} className="rounded-full"><LogOut className="mr-1 h-3 w-3" /> Sign out</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />)}</div>
        ) : sorted.length === 0 ? (
          <div className="rounded-3xl bg-card p-16 text-center shadow-card">
            <Bell className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-display text-2xl">All caught up!</p>
            <p className="text-sm text-muted-foreground">No active orders right now.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((o) => <OrderCard key={o.id} order={o} />)}
          </div>
        )}
      </main>
    </div>
  );
}

const NEXT: Record<OrderStatus, { next: OrderStatus | null; label: string }> = {
  received: { next: "preparing", label: "Start Preparing" },
  preparing: { next: "ready", label: "Mark Ready" },
  ready: { next: "served", label: "Mark Served" },
  served: { next: null, label: "" },
  cancelled: { next: null, label: "" },
};
const STATUS_TONE: Record<OrderStatus, string> = {
  received: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  preparing: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  ready: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  served: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
};

function OrderCard({ order }: { order: Order & { items: OrderItem[] } }) {
  const placed = new Date(order.created_at);
  const mins = Math.floor((Date.now() - placed.getTime()) / 60000);
  const next = NEXT[order.status];
  async function advance() {
    if (!next.next) return;
    const { error } = await supabase.from("orders").update({ status: next.next }).eq("id", order.id);
    if (error) toast.error(error.message);
    else toast.success(`Order #${order.order_number} → ${next.next}`);
  }
  return (
    <article className={cn("rounded-2xl border-2 bg-card p-4 shadow-card transition-smooth", mins > 15 && order.status !== "ready" ? "border-rose-400/60" : "border-transparent")}>
      <header className="flex items-start justify-between">
        <div>
          <p className="font-display text-3xl leading-none">#{order.order_number}</p>
          <p className="mt-1 text-xs text-muted-foreground">Table {order.table_number} · <Clock className="inline h-3 w-3" /> {mins}m ago</p>
        </div>
        <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest", STATUS_TONE[order.status])}>{order.status}</span>
      </header>
      <ul className="my-4 space-y-1.5 text-sm">
        {order.items.map((it) => (
          <li key={it.id}>
            <div className="flex justify-between gap-2">
              <span><span className="font-semibold">{it.quantity}×</span> {it.name}</span>
              <span className="text-muted-foreground">₹{Number(it.line_total).toFixed(0)}</span>
            </div>
            {it.special_instructions && <p className="ml-5 text-xs italic text-amber-700">⚠ {it.special_instructions}</p>}
          </li>
        ))}
      </ul>
      {order.notes && <p className="rounded-xl bg-amber-500/10 p-2 text-xs italic text-amber-800">Note: {order.notes}</p>}
      <footer className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <p className="text-sm font-semibold">₹{Number(order.total).toFixed(0)}</p>
        {next.next && (
          <Button size="sm" onClick={advance} className="rounded-full bg-primary text-primary-foreground hover:opacity-90">{next.label}</Button>
        )}
      </footer>
    </article>
  );
}

let audioCtx: AudioContext | null = null;
function playDing() {
  try {
    audioCtx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const ctx = audioCtx;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880; o.type = "sine";
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    o.start(); o.stop(ctx.currentTime + 0.45);
  } catch { /* ignore */ }
}
