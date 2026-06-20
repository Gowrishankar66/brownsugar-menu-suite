import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { OrderAmendment } from "@/lib/menu-types";
import { History } from "lucide-react";

function formatEntry(a: OrderAmendment): string {
  const d = a.details as Record<string, unknown>;
  switch (a.action) {
    case "item_added":
      return `Added ${String(d.quantity ?? "")} × ${String(d.item ?? "")}`;
    case "item_removed":
      return `Removed ${String(d.quantity ?? "")} × ${String(d.item ?? "")}`;
    case "quantity_changed":
      return `${String(d.item ?? "")} quantity ${String(d.from ?? "")} → ${String(d.to ?? "")}`;
    case "note_added":
      return `Note: ${String(d.note ?? "")}`;
    case "status_changed":
      return `Status ${String(d.from ?? "—")} → ${String(d.to ?? "")}`;
  }
}

export function AmendmentHistory({ orderId, hidePrices = false }: { orderId: string; hidePrices?: boolean }) {
  void hidePrices;
  const [entries, setEntries] = useState<OrderAmendment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data } = await supabase
        .from("order_amendments")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });
      if (!mounted) return;
      setEntries((data ?? []) as unknown as OrderAmendment[]);
      setLoading(false);
    }
    load();
    const ch = supabase
      .channel(`amend-${orderId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_amendments", filter: `order_id=eq.${orderId}` },
        load,
      )
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [orderId]);

  if (loading) return <p className="text-xs text-muted-foreground">Loading history…</p>;
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">No amendments yet.</p>;
  }

  return (
    <ol className="space-y-2 text-xs">
      {entries.map((a) => (
        <li key={a.id} className="flex gap-2">
          <span className="font-ui w-20 shrink-0 text-muted-foreground">
            {new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          <span className="w-16 shrink-0 rounded-full bg-secondary px-2 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wider">
            {a.actor_role}
          </span>
          <span className="flex-1">{formatEntry(a)}</span>
        </li>
      ))}
      <li className="flex items-center gap-1.5 pt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
        <History className="h-3 w-3" /> {entries.length} change{entries.length === 1 ? "" : "s"}
      </li>
    </ol>
  );
}
