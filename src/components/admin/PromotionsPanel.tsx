import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Tag, Calendar, Eye, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PROMO_TYPE_LABELS, type Promotion, type PromotionType, isActiveNow } from "@/lib/promotions";
import type { Category, MenuItem } from "@/lib/menu-types";

export function PromotionsPanel() {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const [p, i, c] = await Promise.all([
      supabase.from("promotions" as never).select("*").order("created_at", { ascending: false }),
      supabase.from("menu_items").select("*").order("name"),
      supabase.from("categories").select("*").order("sort_order"),
    ]);
    setPromos(((p as { data?: Promotion[] }).data ?? []) as Promotion[]);
    setItems((i.data ?? []) as MenuItem[]);
    setCats((c.data ?? []) as Category[]);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl">Promotions & Offers</h2>
        <PromotionDialog items={items} categories={cats} onSaved={refresh} />
      </div>
      {promos.length === 0 ? (
        <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground">No promotions yet — create your first offer.</Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {promos.map((p) => (
            <PromotionRow key={p.id} promo={p} items={items} categories={cats} onChanged={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function PromotionRow({ promo, items, categories, onChanged }: { promo: Promotion; items: MenuItem[]; categories: Category[]; onChanged: () => void }) {
  const active = isActiveNow(promo);
  async function toggle(v: boolean) {
    const { error } = await supabase.from("promotions" as never).update({ active: v } as never).eq("id", promo.id);
    if (error) toast.error(error.message); else { toast.success(v ? "Activated" : "Deactivated"); onChanged(); }
  }
  async function del() {
    if (!confirm(`Delete "${promo.name}"?`)) return;
    const { error } = await supabase.from("promotions" as never).delete().eq("id", promo.id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); onChanged(); }
  }
  return (
    <Card className="rounded-2xl p-4 shadow-card">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Tag className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{promo.name}</p>
            {active ? <Badge className="bg-emerald-500/15 text-emerald-700">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
          </div>
          <p className="text-[11px] text-muted-foreground">{PROMO_TYPE_LABELS[promo.type]}</p>
          {promo.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{promo.description}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground font-ui">
            <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{promo.views_count}</span>
            <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{promo.usage_count} used</span>
            <span>₹{Number(promo.revenue_generated).toFixed(0)}</span>
            {promo.end_date && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />until {new Date(promo.end_date).toLocaleDateString()}</span>}
          </div>
        </div>
        <Switch checked={promo.active} onCheckedChange={toggle} />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <PromotionDialog promo={promo} items={items} categories={categories} onSaved={onChanged} trigger={<Button variant="ghost" size="sm" className="rounded-full"><Pencil className="h-3.5 w-3.5" /></Button>} />
        <Button variant="ghost" size="sm" onClick={del} className="rounded-full text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    </Card>
  );
}

function PromotionDialog({ promo, items, categories, onSaved, trigger }: { promo?: Promotion; items: MenuItem[]; categories: Category[]; onSaved: () => void; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(promo?.name ?? "");
  const [description, setDescription] = useState(promo?.description ?? "");
  const [type, setType] = useState<PromotionType>(promo?.type ?? "bogo");
  const [eligibleItem, setEligibleItem] = useState<string>(promo?.eligible_item_ids?.[0] ?? "");
  const [eligibleCat, setEligibleCat] = useState<string>(promo?.eligible_category_ids?.[0] ?? "");
  const [rewardItem, setRewardItem] = useState<string>(promo?.reward_item_ids?.[0] ?? "");
  const [discountValue, setDiscountValue] = useState(promo?.discount_value.toString() ?? "0");
  const [minSubtotal, setMinSubtotal] = useState(promo?.min_subtotal.toString() ?? "0");
  const [startDate, setStartDate] = useState(promo?.start_date?.slice(0, 10) ?? "");
  const [endDate, setEndDate] = useState(promo?.end_date?.slice(0, 10) ?? "");
  const [active, setActive] = useState(promo?.active ?? true);
  const [maxUsage, setMaxUsage] = useState(promo?.max_usage?.toString() ?? "");
  const [busy, setBusy] = useState(false);

  const showReward = useMemo(() => ["bogo", "b2g1", "combo", "free_dessert", "free_beverage"].includes(type), [type]);
  const showDiscount = useMemo(() => ["flat_discount", "percent_discount", "festival", "happy_hour", "weekend", "custom"].includes(type), [type]);
  const showMinSpend = showDiscount;

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload = {
      name, description: description || null, type,
      eligible_item_ids: eligibleItem ? [eligibleItem] : [],
      eligible_category_ids: eligibleCat ? [eligibleCat] : [],
      reward_item_ids: rewardItem ? [rewardItem] : [],
      reward_category_ids: [],
      discount_value: parseFloat(discountValue) || 0,
      min_subtotal: parseFloat(minSubtotal) || 0,
      start_date: startDate ? new Date(startDate).toISOString() : null,
      end_date: endDate ? new Date(endDate + "T23:59:59").toISOString() : null,
      active,
      max_usage: maxUsage ? parseInt(maxUsage) : null,
    };
    const res = promo
      ? await supabase.from("promotions" as never).update(payload as never).eq("id", promo.id)
      : await supabase.from("promotions" as never).insert(payload as never);
    setBusy(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(promo ? "Offer updated" : "Offer created");
    setOpen(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button className="h-9 rounded-full"><Plus className="mr-1 h-4 w-4" /> New Offer</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="font-display">{promo ? "Edit" : "Create"} promotion</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid gap-3">
          <div>
            <Label>Offer name</Label>
            <Input value={name} required onChange={(e) => setName(e.target.value)} className="mt-1 h-9" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 min-h-[60px] text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as PromotionType)}>
                <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PROMO_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Label className="flex items-center gap-2">Active <Switch checked={active} onCheckedChange={setActive} /></Label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Eligible item</Label>
              <Select value={eligibleItem || "any"} onValueChange={(v) => setEligibleItem(v === "any" ? "" : v)}>
                <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any item</SelectItem>
                  {items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Eligible category</Label>
              <Select value={eligibleCat || "any"} onValueChange={(v) => setEligibleCat(v === "any" ? "" : v)}>
                <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any category</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {showReward && (
            <div>
              <Label>Reward item</Label>
              <Select value={rewardItem || "none"} onValueChange={(v) => setRewardItem(v === "none" ? "" : v)}>
                <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {showDiscount && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Discount value {type === "percent_discount" ? "(%)" : "(₹)"}</Label>
                <Input type="number" min={0} step="0.01" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className="mt-1 h-9" />
              </div>
              {showMinSpend && (
                <div>
                  <Label>Min subtotal (₹)</Label>
                  <Input type="number" min={0} step="0.01" value={minSubtotal} onChange={(e) => setMinSubtotal(e.target.value)} className="mt-1 h-9" />
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Start date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 h-9" />
            </div>
            <div>
              <Label>End date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 h-9" />
            </div>
            <div>
              <Label>Max uses</Label>
              <Input type="number" min={0} value={maxUsage} onChange={(e) => setMaxUsage(e.target.value)} placeholder="∞" className="mt-1 h-9" />
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-full">Cancel</Button>
            <Button type="submit" disabled={busy} className="rounded-full">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
