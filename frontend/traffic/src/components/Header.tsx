import { Link } from 'react-router-dom';
import { MapPin, Database, Zap } from 'lucide-react';

/** Small traffic-light mark for the app header (reads at ~36px). */
function TrafficLogoMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="traffic-logo-housing" x1="8" y1="4" x2="32" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1e293b" />
          <stop offset="1" stopColor="#0f172a" />
        </linearGradient>
      </defs>
      <rect x="10" y="3" width="20" height="27" rx="5" fill="url(#traffic-logo-housing)" stroke="#334155" strokeWidth="1" />
      <circle cx="20" cy="11.5" r="4.2" fill="#dc2626" />
      <circle cx="20" cy="11.5" r="2.2" fill="#fca5a5" opacity="0.45" />
      <circle cx="20" cy="19.5" r="4.2" fill="#ca8a04" />
      <circle cx="20" cy="19.5" r="2.2" fill="#fde047" opacity="0.5" />
      <circle cx="20" cy="27.5" r="4.2" fill="#16a34a" />
      <circle cx="20" cy="27.5" r="2.2" fill="#86efac" opacity="0.45" />
      <rect x="18" y="30" width="4" height="7" rx="1" fill="#475569" />
    </svg>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="geo-main-shell flex h-[3.25rem] items-center justify-between gap-4 py-0">
        <Link
          to="/"
          className="group flex items-center gap-2.5 no-underline hover:no-underline"
          aria-label="GeoAI Traffic Analysis home"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-b from-slate-800 to-slate-950 shadow-[0_4px_14px_rgba(15,23,42,0.55)] ring-1 ring-white/10 transition-transform group-hover:scale-[1.03]">
            <TrafficLogoMark className="h-[1.65rem] w-[1.65rem] text-foreground" />
          </span>
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
            Geocoded Database
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
