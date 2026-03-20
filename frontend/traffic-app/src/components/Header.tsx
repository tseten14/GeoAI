import { Link } from 'react-router-dom';
import { MapPin, Database, Zap } from 'lucide-react';

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="geo-main-shell flex h-[3.25rem] items-center justify-between gap-4 py-0">
        <Link to="/" className="group flex items-center gap-2.5 no-underline hover:no-underline">
          <span
            className="h-9 w-9 shrink-0 rounded-[10px] bg-gradient-to-br from-[hsl(217,91%,60%)] to-[hsl(189,94%,53%)] shadow-[0_4px_14px_rgba(59,130,246,0.35)]"
            aria-hidden
          />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="text-[0.95rem] font-bold tracking-tight text-foreground">
              GeoAI: Traffic Analysis
            </span>
            <span className="text-[0.7rem] font-medium text-muted-foreground">
              OpenStreetMap traffic insights
            </span>
          </span>
        </Link>

        <div className="hidden items-center gap-5 sm:flex">
          <a
            href="/contacts"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            <MapPin className="h-3.5 w-3.5 text-primary" />
            Geocoded contacts
          </a>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Database className="h-3.5 w-3.5 text-primary" />
            OpenStreetMap
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Zap className="h-3.5 w-3.5 text-[hsl(189,94%,53%)]" />
            Live analysis
          </div>
        </div>
      </div>
    </header>
  );
}
