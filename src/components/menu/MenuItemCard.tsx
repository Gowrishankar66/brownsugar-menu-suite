import { motion } from "framer-motion";
import { Leaf, Drumstick, ImageOff } from "lucide-react";
import type { MenuItem } from "@/lib/menu-types";
import { cn } from "@/lib/utils";

export function MenuItemCard({ item }: { item: MenuItem }) {
  const soldOut = !item.available;
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "group relative overflow-hidden rounded-3xl bg-card shadow-card transition-smooth hover:-translate-y-1 hover:shadow-elegant",
        soldOut && "opacity-60",
      )}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            loading="lazy"
            className="h-full w-full object-cover transition-smooth group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-glow/40 to-secondary text-primary-foreground/50">
            <ImageOff className="h-10 w-10" />
          </div>
        )}

        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-card/90 px-2.5 py-1 text-[11px] font-medium shadow-soft backdrop-blur">
          {item.veg_type === "veg" ? (
            <>
              <Leaf className="h-3 w-3 text-emerald-600" />
              <span className="text-emerald-700">Veg</span>
            </>
          ) : (
            <>
              <Drumstick className="h-3 w-3 text-rose-600" />
              <span className="text-rose-700">Non-Veg</span>
            </>
          )}
        </div>

        <div
          className={cn(
            "absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-soft backdrop-blur",
            soldOut
              ? "bg-destructive/90 text-destructive-foreground"
              : "bg-primary/90 text-primary-foreground",
          )}
        >
          {soldOut ? "Sold Out" : "Available"}
        </div>
      </div>

      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg leading-tight text-foreground">{item.name}</h3>
          <span className="shrink-0 rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground">
            ₹{Number(item.price).toFixed(0)}
          </span>
        </div>
        {item.description && (
          <p className="text-sm leading-relaxed text-muted-foreground line-clamp-2">{item.description}</p>
        )}
      </div>
    </motion.article>
  );
}
