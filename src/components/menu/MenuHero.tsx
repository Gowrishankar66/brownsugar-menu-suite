import { Clock, MapPin } from "lucide-react";

const MAP_URL = "https://maps.app.goo.gl/4wswYMMeJ6nWr4A99";
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
        <div className="mt-5 flex flex-col items-center justify-center gap-1 sm:flex-row sm:items-baseline sm:gap-3">
          <h1 className="font-display text-5xl leading-[1.05] text-foreground sm:text-6xl">
            BrownSugar
          </h1>
          <span className="font-display text-sm italic font-light text-muted-foreground sm:text-base">
            by Master Chef Devaki
          </span>
        </div>
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
            <p className="mt-1 text-sm font-semibold text-foreground">Open Daily · 10:00 AM – 2:00 AM</p>
          </div>
          <a
            href={MAP_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl bg-card/80 p-3 shadow-card backdrop-blur transition-smooth hover:-translate-y-0.5 hover:shadow-elegant"
          >
            <div className="flex items-center gap-2 text-primary-foreground/70">
              <MapPin className="h-3.5 w-3.5" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">Location</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-foreground">View on Google Maps</p>
          </a>
        </div>

        <div className="mt-6 flex justify-center">
          <a
            href={MAP_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-soft transition-smooth hover:-translate-y-0.5 hover:shadow-elegant"
          >
            <MapPin className="h-4 w-4" /> View Location
          </a>
        </div>
      </div>
    </header>
  );
}
