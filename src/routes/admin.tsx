import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { LogOut, Plus, Trash2, Image as ImageIcon, Loader2, ShieldCheck, ChefHat, Download } from "lucide-react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import type { Category, MenuItem } from "@/lib/menu-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { OrdersPanel } from "@/components/admin/OrdersPanel";
import { AnalyticsPanel } from "@/components/admin/AnalyticsPanel";
import { PromotionsPanel } from "@/components/admin/PromotionsPanel";
import { NotificationSettings } from "@/components/admin/NotificationSettings";
import { playNotify, startRinging, stopRinging, loadNotifySettings } from "@/lib/notify-sound";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "BrownSugar — Admin" }, { name: "robots", content: "noindex" }] }),
});

function AdminPage() {
  const [session, setSession] = useState<unknown>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) checkAdmin(s.user.id);
      else { setIsAdmin(false); setChecking(false); }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) checkAdmin(data.session.user.id);
      else setChecking(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function checkAdmin(uid: string) {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
    setIsAdmin(!!data);
    setChecking(false);
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return <AuthForm />;
  if (!isAdmin) return <NotAdmin />;
  return <Dashboard />;
}

function AuthForm() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + "/admin" },
        });
        if (error) throw error;
        toast.success("Account created. You can now sign in.");
        setMode("login");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function sendReset(e: FormEvent) {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: window.location.origin + "/reset-password",
    });
    setForgotBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Check your email for the reset link");
    setForgotOpen(false);
    setForgotEmail("");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-hero px-4">
      <Card className="w-full max-w-md rounded-3xl border-0 p-8 shadow-elegant">
        <div className="text-center">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-display text-3xl">BrownSugar Admin</h1>
          <p className="text-[11px] font-light tracking-[0.2em] text-muted-foreground/80 uppercase mt-1">by Master Chef Devaki</p>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to manage the menu</p>
        </div>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 h-11 rounded-xl" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 h-11 rounded-xl" />
          </div>
          <Button type="submit" disabled={busy} className="h-11 w-full rounded-xl bg-primary text-primary-foreground hover:opacity-90">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "login" ? "Sign In" : "Create Account"}
          </Button>
          {mode === "login" && (
            <button type="button" onClick={() => { setForgotEmail(email); setForgotOpen(true); }} className="block w-full text-center text-xs text-primary hover:underline">
              Forgot password?
            </button>
          )}
          <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")} className="block w-full text-center text-xs text-muted-foreground hover:text-primary">
            {mode === "login" ? "First time? Create an admin account" : "Have an account? Sign in"}
          </button>
        </form>
      </Card>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Reset your password</DialogTitle>
          </DialogHeader>
          <form onSubmit={sendReset} className="space-y-4">
            <p className="text-sm text-muted-foreground">Enter the email associated with your admin account and we'll send you a secure reset link.</p>
            <div>
              <Label htmlFor="femail">Email</Label>
              <Input id="femail" type="email" required value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} className="mt-1.5 h-11 rounded-xl" />
            </div>
            <Button type="submit" disabled={forgotBusy} className="h-11 w-full rounded-xl bg-primary text-primary-foreground hover:opacity-90">
              {forgotBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NotAdmin() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
      <Card className="max-w-md rounded-3xl p-8 shadow-elegant">
        <h1 className="font-display text-2xl">Not authorized</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account doesn't have admin access. Ask an existing admin to grant you the <code className="rounded bg-muted px-1">admin</code> role, or run this SQL in Lovable Cloud:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-muted p-3 text-left text-[11px]">
{`insert into user_roles (user_id, role)
select id, 'admin' from auth.users
where email = 'you@example.com';`}
        </pre>
        <Button onClick={() => supabase.auth.signOut()} variant="outline" className="mt-4 rounded-full">
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </Card>
    </div>
  );
}

function Dashboard() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const [c, i] = await Promise.all([
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("menu_items").select("*").order("created_at", { ascending: false }),
    ]);
    setCategories((c.data ?? []) as Category[]);
    setItems((i.data ?? []) as MenuItem[]);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  // Realtime: chime + continuous ringer for any unaccepted ("new") orders.
  useEffect(() => {
    let cancelled = false;
    async function refreshRinger() {
      const { data } = await supabase.from("orders").select("id").eq("status", "new").limit(1);
      const s = loadNotifySettings();
      const hasNew = (data ?? []).length > 0;
      if (cancelled) return;
      if (s.enabled && s.mode === "continuous" && hasNew) startRinging(s);
      else stopRinging();
    }
    refreshRinger();
    const ch = supabase
      .channel("admin-orders-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (p) => {
        const o = p.new as { order_number: string; table_number: number };
        playNotify("new");
        toast.success(`New order #${o.order_number} — Table ${o.table_number}`);
        refreshRinger();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (p) => {
        const o = p.new as { status: string; order_number: string };
        if (o.status === "cancelled") {
          playNotify("cancelled");
          toast.warning(`Order #${o.order_number} cancelled`);
        }
        refreshRinger();
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); stopRinging(); };
  }, []);


  const stats = {
    total: items.length,
    available: items.filter((i) => i.available).length,
    soldOut: items.filter((i) => !i.available).length,
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="font-display text-xl">BrownSugar Admin</h1>
            <p className="text-[11px] text-muted-foreground">Manage your live menu</p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationSettings />
            <a href="/kitchen"><Button variant="outline" size="sm" className="rounded-full"><ChefHat className="mr-1.5 h-3.5 w-3.5" /> Kitchen</Button></a>
            <Button variant="outline" size="sm" onClick={() => supabase.auth.signOut()} className="rounded-full">
              <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 p-4 pb-16">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Total Items" value={stats.total} tone="default" />
          <StatCard label="Available" value={stats.available} tone="primary" />
          <StatCard label="Sold Out" value={stats.soldOut} tone="destructive" />
        </div>

        <Tabs defaultValue="items">
          <TabsList className="flex h-auto flex-wrap rounded-2xl">
            <TabsTrigger value="items" className="rounded-full">Menu Items</TabsTrigger>
            <TabsTrigger value="categories" className="rounded-full">Categories</TabsTrigger>
            <TabsTrigger value="tables" className="rounded-full">Tables &amp; QR</TabsTrigger>
            <TabsTrigger value="orders" className="rounded-full">Orders</TabsTrigger>
            <TabsTrigger value="promotions" className="rounded-full">Promotions</TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-full">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="items" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl">Items</h2>
              <ItemDialog categories={categories} onSaved={refresh} />
            </div>
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>
            ) : items.length === 0 ? (
              <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground">No items yet — add your first one!</Card>
            ) : (
              <div className="space-y-2">
                {items.map((it) => (
                  <ItemRow key={it.id} item={it} categories={categories} onChanged={refresh} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="categories" className="mt-4">
            <CategoriesPanel categories={categories} onChanged={refresh} />
          </TabsContent>

          <TabsContent value="tables" className="mt-4">
            <TablesPanel />
          </TabsContent>

          <TabsContent value="orders" className="mt-4">
            <OrdersPanel />
          </TabsContent>

          <TabsContent value="promotions" className="mt-4">
            <PromotionsPanel />
          </TabsContent>

          <TabsContent value="analytics" className="mt-4">
            <AnalyticsPanel />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: "default" | "primary" | "destructive" }) {
  const colors = {
    default: "bg-card text-foreground",
    primary: "bg-gradient-primary text-primary-foreground",
    destructive: "bg-destructive/10 text-destructive",
  }[tone];
  return (
    <Card className={`rounded-2xl border-0 p-5 shadow-card ${colors}`}>
      <p className="text-[11px] font-semibold uppercase tracking-widest opacity-80">{label}</p>
      <p className="mt-1 font-ui text-4xl font-bold">{value}</p>
    </Card>
  );
}

function ItemRow({ item, categories, onChanged }: { item: MenuItem; categories: Category[]; onChanged: () => void }) {
  const cat = categories.find((c) => c.id === item.category_id);
  async function toggle(v: boolean) {
    const { error } = await supabase.from("menu_items").update({ available: v }).eq("id", item.id);
    if (error) toast.error(error.message);
    else { toast.success(v ? "Marked available" : "Marked sold out"); onChanged(); }
  }
  async function del() {
    if (!confirm(`Delete "${item.name}"?`)) return;
    const { error } = await supabase.from("menu_items").delete().eq("id", item.id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); onChanged(); }
  }
  return (
    <Card className="flex items-center gap-3 rounded-2xl p-3 shadow-card">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
        {item.image_url ? <img src={item.image_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-5 w-5 text-muted-foreground" /></div>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{item.name}</p>
        <p className="truncate text-xs text-muted-foreground">{cat?.name ?? "—"} · ₹{Number(item.price).toFixed(0)} · {item.veg_type}</p>
      </div>
      <Switch checked={item.available} onCheckedChange={toggle} />
      <ItemDialog item={item} categories={categories} onSaved={onChanged} />
      <Button variant="ghost" size="icon" onClick={del} className="text-destructive hover:bg-destructive/10">
        <Trash2 className="h-4 w-4" />
      </Button>
    </Card>
  );
}

function ItemDialog({ item, categories, onSaved }: { item?: MenuItem; categories: Category[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(item?.name ?? "");
  const [sku, setSku] = useState(item?.sku ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [price, setPrice] = useState(item?.price.toString() ?? "");
  
  const [categoryId, setCategoryId] = useState(item?.category_id ?? categories[0]?.id ?? "");
  const [vegType, setVegType] = useState<"veg" | "non-veg">(item?.veg_type ?? "veg");
  const [available, setAvailable] = useState(item?.available ?? true);
  const [imageUrl, setImageUrl] = useState(item?.image_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-z0-9.\-]/gi, "_")}`;
      const { error } = await supabase.storage.from("menu-images").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("menu-images").getPublicUrl(path);
      setImageUrl(data.publicUrl);
      toast.success("Image uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload = {
      name, description: description || null, price: parseFloat(price) || 0,
      gst_percentage: 5, // GST is fixed system-wide at 5% (CGST 2.5% + SGST 2.5%)
      sku: sku.trim() || null,
      category_id: categoryId || null, veg_type: vegType, available, image_url: imageUrl || null,
    };
    const res = item
      ? await supabase.from("menu_items").update(payload).eq("id", item.id)
      : await supabase.from("menu_items").insert(payload);
    setBusy(false);
    if (res.error) toast.error(res.error.message);
    else { toast.success(item ? "Updated" : "Item added"); onSaved(); setOpen(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {item ? (
          <Button variant="ghost" size="sm" className="rounded-full">Edit</Button>
        ) : (
          <Button className="rounded-full bg-primary text-primary-foreground hover:opacity-90"><Plus className="mr-1 h-4 w-4" /> Add Item</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader><DialogTitle className="font-display text-2xl">{item ? "Edit Item" : "New Item"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div>
            <Label>Image</Label>
            <div className="mt-1.5 flex items-center gap-3">
              <div className="h-20 w-20 overflow-hidden rounded-xl bg-muted">
                {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-6 w-6 text-muted-foreground" /></div>}
              </div>
              <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} disabled={uploading} className="flex-1" />
            </div>
          </div>
          <div>
            <Label>Name</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1.5" />
          </div>
          <div>
            <Label>SKU / Item #</Label>
            <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="ITM-0001" className="mt-1.5" />
            <p className="mt-1 text-[11px] text-muted-foreground">GST is fixed system-wide at 5% (CGST 2.5% + SGST 2.5%).</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Price (₹)</Label>
              <Input type="number" step="0.01" min="0" required value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={vegType} onValueChange={(v) => setVegType(v as "veg" | "non-veg")}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="veg">Veg</SelectItem>
                  <SelectItem value="non-veg">Non-Veg</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end justify-between rounded-xl bg-secondary p-3">
              <Label htmlFor="avail" className="cursor-pointer">Available</Label>
              <Switch id="avail" checked={available} onCheckedChange={setAvailable} />
            </div>
          </div>
          <Button type="submit" disabled={busy} className="h-11 w-full rounded-xl bg-primary text-primary-foreground hover:opacity-90">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : item ? "Save Changes" : "Create Item"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CategoriesPanel({ categories, onChanged }: { categories: Category[]; onChanged: () => void }) {
  const [name, setName] = useState("");
  async function add(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const { error } = await supabase.from("categories").insert({ name: name.trim(), sort_order: categories.length + 1 });
    if (error) toast.error(error.message);
    else { toast.success("Category added"); setName(""); onChanged(); }
  }
  async function del(id: string) {
    if (!confirm("Delete this category and all its items?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); onChanged(); }
  }
  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category name" className="rounded-xl" />
        <Button type="submit" className="rounded-xl bg-primary text-primary-foreground hover:opacity-90"><Plus className="h-4 w-4" /></Button>
      </form>
      <div className="space-y-2">
        {categories.map((c) => (
          <Card key={c.id} className="flex items-center justify-between rounded-2xl p-4 shadow-card">
            <span className="font-medium">{c.name}</span>
            <Button variant="ghost" size="icon" onClick={() => del(c.id)} className="text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4" />
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

type TableRow = { id: string; table_number: number; name: string; active: boolean; created_at: string };

function TablesPanel() {
  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newNum, setNewNum] = useState("");
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function refresh() {
    const { data } = await supabase.from("tables").select("*").order("table_number");
    setTables((data ?? []) as TableRow[]);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  async function addTable(e: FormEvent) {
    e.preventDefault();
    const n = parseInt(newNum, 10);
    if (!n || !newName.trim()) return;
    const { error } = await supabase.from("tables").insert({ table_number: n, name: newName.trim() });
    if (error) toast.error(error.message);
    else { toast.success("Table added"); setNewName(""); setNewNum(""); refresh(); }
  }
  async function toggle(t: TableRow) {
    const { error } = await supabase.from("tables").update({ active: !t.active }).eq("id", t.id);
    if (error) toast.error(error.message); else refresh();
  }
  async function rename(t: TableRow) {
    const name = prompt("Table name", t.name);
    if (!name) return;
    const { error } = await supabase.from("tables").update({ name }).eq("id", t.id);
    if (error) toast.error(error.message); else refresh();
  }
  async function del(t: TableRow) {
    if (!confirm(`Delete ${t.name}?`)) return;
    const { error } = await supabase.from("tables").delete().eq("id", t.id);
    if (error) toast.error(error.message); else refresh();
  }
  async function downloadQR(t: TableRow) {
    const url = `${origin}/order?table=${t.table_number}`;
    const dataUrl = await QRCode.toDataURL(url, { width: 600, margin: 2 });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `qr-table-${t.table_number}.png`;
    a.click();
  }
  function printQR(t: TableRow) {
    const url = `${origin}/order?table=${t.table_number}`;
    QRCode.toDataURL(url, { width: 600, margin: 2 }).then((dataUrl) => {
      const w = window.open("", "_blank");
      if (!w) return;
      w.document.write(`<html><head><title>QR ${t.name}</title></head><body style="text-align:center;font-family:sans-serif;padding:40px"><h1>${t.name}</h1><p>Scan to order at BrownSugar Café</p><img src="${dataUrl}" style="width:400px"/><p style="font-size:12px;color:#666">${url}</p><script>setTimeout(()=>window.print(),300)</script></body></html>`);
      w.document.close();
    });
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl p-4 shadow-card">
        <form onSubmit={addTable} className="grid grid-cols-[100px_1fr_auto] gap-2">
          <Input type="number" min="1" value={newNum} onChange={(e) => setNewNum(e.target.value)} placeholder="No." />
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Table name (e.g. Patio 1)" />
          <Button type="submit" className="rounded-xl bg-primary text-primary-foreground"><Plus className="h-4 w-4" /></Button>
        </form>
      </Card>
      {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tables.map((t) => (
            <Card key={t.id} className={`rounded-2xl p-4 shadow-card ${!t.active && "opacity-60"}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-xl">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground">#{t.table_number}</p>
                </div>
                <Switch checked={t.active} onCheckedChange={() => toggle(t)} />
              </div>
              <QrPreview url={`${origin}/order?table=${t.table_number}`} />
              <p className="mt-1 truncate text-[10px] text-muted-foreground" title={`${origin}/order?table=${t.table_number}`}>/order?table={t.table_number}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                <Button size="sm" variant="outline" className="h-7 rounded-full text-xs" onClick={() => downloadQR(t)}><Download className="mr-1 h-3 w-3" /> PNG</Button>
                <Button size="sm" variant="outline" className="h-7 rounded-full text-xs" onClick={() => printQR(t)}>Print</Button>
                <Button size="sm" variant="ghost" className="h-7 rounded-full text-xs" onClick={() => rename(t)}>Rename</Button>
                <Button size="sm" variant="ghost" className="h-7 rounded-full text-xs text-destructive hover:bg-destructive/10" onClick={() => del(t)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function QrPreview({ url }: { url: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => { QRCode.toDataURL(url, { width: 240, margin: 1 }).then(setSrc); }, [url]);
  return (
    <div className="mx-auto mt-3 grid h-32 w-32 place-items-center rounded-xl bg-white p-2">
      {src && <img src={src} alt="QR" className="h-full w-full" />}
    </div>
  );
}

