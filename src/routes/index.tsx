import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Category, MenuItem } from "@/lib/menu-types";
import { MenuHero } from "@/components/menu/MenuHero";
import { MenuFooter } from "@/components/menu/MenuFooter";
import { MenuItemCard } from "@/components/menu/MenuItemCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: MenuPage,
  head: () => ({
    meta: [
      { title: "BrownSugar Café — Live Menu by Master Chef Devaki" },
      { name: "description", content: "Browse the live BrownSugar Café menu — handcrafted coffee, tea, momos, burgers, sandwiches and signature desserts by Master Chef Devaki." },
      { property: "og:title", content: "BrownSugar Café — Live Menu by Master Chef Devaki" },
      { property: "og:description", content: "Scan, sip, savour. Explore the live menu of coffee, tea, momos, burgers and indulgent desserts." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://brown-sugar-menu.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://brown-sugar-menu.lovable.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Restaurant",
          name: "BrownSugar Café",
          description: "Dessert and coffee café by Master Chef Devaki serving handcrafted coffee, tea, momos, burgers, sandwiches and signature desserts.",
          servesCuisine: ["Coffee", "Desserts", "Momos", "Burgers", "Sandwiches"],
          url: "https://brown-sugar-menu.lovable.app/",
          hasMenu: "https://brown-sugar-menu.lovable.app/",
          acceptsReservations: false,
        }),
      },
    ],
  }),
});

type Filter = "all" | "veg" | "non-veg" | "available";

function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<string | "all">("all");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [c, i] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order"),
        supabase.from("menu_items").select("*").order("sort_order"),
      ]);
      if (!mounted) return;
      setCategories((c.data ?? []) as Category[]);
      setItems((i.data ?? []) as MenuItem[]);
      setLoading(false);
    })();

    const channel = supabase
      .channel("menu-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, async () => {
        const { data } = await supabase.from("menu_items").select("*").order("sort_order");
        setItems((data ?? []) as MenuItem[]);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, async () => {
        const { data } = await supabase.from("categories").select("*").order("sort_order");
        setCategories((data ?? []) as Category[]);
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (activeCat !== "all" && it.category_id !== activeCat) return false;
      if (filter === "veg" && it.veg_type !== "veg") return false;
      if (filter === "non-veg" && it.veg_type !== "non-veg") return false;
      if (filter === "available" && !it.available) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!it.name.toLowerCase().includes(q) && !(it.description ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, activeCat, filter, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const cat of categories) map.set(cat.id, []);
    for (const it of filtered) {
      if (!it.category_id) continue;
      map.get(it.category_id)?.push(it);
    }
    return map;
  }, [filtered, categories]);

  return (
    <div className="min-h-screen bg-background pb-12">
      <MenuHero />

      {/* Search & filters */}
      <section className="mx-auto -mt-6 max-w-3xl px-4">
        <div className="rounded-3xl bg-card p-3 shadow-elegant">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the menu..."
              className="h-12 rounded-2xl border-0 bg-secondary pl-11 text-base shadow-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
            <SlidersHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" />
            {(["all", "veg", "non-veg", "available"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-smooth",
                  filter === f ? "bg-primary text-primary-foreground shadow-soft" : "bg-secondary text-secondary-foreground hover:bg-accent",
                )}
              >
                {f === "all" ? "All" : f === "veg" ? "Veg" : f === "non-veg" ? "Non-Veg" : "Available"}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Sticky category nav */}
      <nav className="sticky top-0 z-30 mt-6 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-3xl overflow-x-auto px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveCat("all")}
              className={cn(
                "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-smooth",
                activeCat === "all" ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground",
              )}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={cn(
                  "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-smooth",
                  activeCat === c.id ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Menu */}
      <main className="mx-auto max-w-3xl px-4 pt-8">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-3xl bg-muted" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl bg-card p-10 text-center shadow-card">
            <p className="font-display text-2xl text-foreground">Nothing found</p>
            <p className="mt-2 text-sm text-muted-foreground">Try a different search or filter.</p>
            <Button onClick={() => { setQuery(""); setFilter("all"); setActiveCat("all"); }} className="mt-5 rounded-full">
              Reset filters
            </Button>
          </div>
        ) : (
          categories.map((cat) => {
            const list = grouped.get(cat.id) ?? [];
            if (list.length === 0) return null;
            if (activeCat !== "all" && activeCat !== cat.id) return null;
            return (
              <section key={cat.id} className="mb-10">
                <div className="mb-4 flex items-end justify-between">
                  <h2 className="font-display text-3xl text-foreground">{cat.name}</h2>
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">{list.length} items</span>
                </div>
                <motion.div layout className="grid gap-4 sm:grid-cols-2">
                  <AnimatePresence>
                    {list.map((item) => (
                      <MenuItemCard key={item.id} item={item} />
                    ))}
                  </AnimatePresence>
                </motion.div>
              </section>
            );
          })
        )}
      </main>

      <MenuFooter />
    </div>
  );
}
