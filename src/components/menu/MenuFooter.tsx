import { Instagram, MessageCircle, MapPin } from "lucide-react";

export function MenuFooter() {
  return (
    <footer className="mt-16 rounded-t-[2.5rem] bg-gradient-primary px-6 py-10 text-center text-primary-foreground">
      <h2 className="font-display text-2xl">Visit BrownSugar</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm opacity-80">
        Stay connected with our newest treats and seasonal specials.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <a
          href="https://instagram.com"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-card px-5 py-2.5 text-sm font-medium text-foreground shadow-soft transition-smooth hover:-translate-y-0.5"
        >
          <Instagram className="h-4 w-4" /> Instagram
        </a>
        <a
          href="https://wa.me/911234567890"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-card px-5 py-2.5 text-sm font-medium text-foreground shadow-soft transition-smooth hover:-translate-y-0.5"
        >
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </a>
        <a
          href="https://maps.google.com/?q=BrownSugar+Cafe"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-card px-5 py-2.5 text-sm font-medium text-foreground shadow-soft transition-smooth hover:-translate-y-0.5"
        >
          <MapPin className="h-4 w-4" /> Find Us
        </a>
      </div>
      <p className="mt-8 text-xs opacity-70">© {new Date().getFullYear()} BrownSugar Café · All rights reserved</p>
    </footer>
  );
}
