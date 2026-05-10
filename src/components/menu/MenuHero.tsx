import { Clock, MapPin } from "lucide-react";
import heroImg from "@/assets/hero.jpg";

export function MenuHero() {
  return (
    <header className="relative overflow-hidden rounded-b-[2.5rem] bg-hero pb-10 pt-8 shadow-soft">
      <div className="absolute inset-0 -z-10 opacity-60">
        <img src={heroImg} alt="" width={1920} height={1080} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/60 to-background" />
      </div>

      <div className="mx-auto max-w-3xl px-5 text-center">
        <div className="mx-auto inline-flex items-center justify-center rounded-full glass px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-primary-foreground/80">
          Premium Café · QR Menu
        </div>
        <h1 className="mt-5 font-display text-5xl leading-[1.05] text-foreground sm:text-6xl">
          BrownSugar
        </h1>
        <p className="mt-3 text-sm font-medium tracking-[0.3em] text-primary-foreground/70 uppercase">
          Fresh · Cozy · Delicious
        </p>
        <p className="mx-auto mt-4 max-w-md text-balance text-sm text-muted-foreground">
          A boutique café experience — handcrafted coffee, warm bites, and indulgent desserts, served with love.
        </p>

        <div className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-3 text-left">
          <div className="rounded-2xl bg-card/80 p-3 shadow-card backdrop-blur">
            <div className="flex items-center gap-2 text-primary-foreground/70">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">Open Today</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-foreground">8:00 AM – 11:00 PM</p>
          </div>
          <div className="rounded-2xl bg-card/80 p-3 shadow-card backdrop-blur">
            <div className="flex items-center gap-2 text-primary-foreground/70">
              <MapPin className="h-3.5 w-3.5" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">Location</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-foreground">Main Street · City</p>
          </div>
        </div>
      </div>
    </header>
  );
}
