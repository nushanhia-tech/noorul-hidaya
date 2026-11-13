import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

/** Default emblem (original): an open book beneath an eight-point star. Replaced by the uploaded logo when set. */
export function Emblem({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("text-accent", className)} aria-hidden fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round">
      <path d="M24 3.5l2.2 3.3 3.9-.8-.8 3.9 3.3 2.2-3.3 2.2.8 3.9-3.9-.8L24 21.5l-2.2-3.3-3.9.8.8-3.9-3.3-2.2 3.3-2.2-.8-3.9 3.9.8z" fill="currentColor" stroke="none" />
      <path d="M5 21c7-1.5 13 0 19 5 6-5 12-6.5 19-5v20c-7-1.5-13 0-19 5-6-5-12-6.5-19-5z" />
      <path d="M24 26v20" />
    </svg>
  );
}

export function Logo({ name, logoPath, className, compact }: { name: string; logoPath?: string | null; className?: string; compact?: boolean }) {
  const src = mediaUrl(logoPath);
  const words = name.split(" ");
  const mid = Math.ceil(words.length / 2);
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-10 w-auto max-w-[56px] object-contain" />
      ) : (
        <Emblem className="h-10 w-10 shrink-0" />
      )}
      <span className={cn("font-display text-[11.5px] font-semibold uppercase leading-[1.15] tracking-[0.02em] text-ink", compact && "text-[10.5px]")}>
        <span className="block">{words.slice(0, mid).join(" ")}</span>
        <span className="block">{words.slice(mid).join(" ")}</span>
      </span>
    </span>
  );
}

/** Subtle eight-point-star lattice used behind heroes and section headers. */
export function GeoPattern({ className, id = "geo" }: { className?: string; id?: string }) {
  return (
    <svg className={cn("pointer-events-none absolute inset-0 h-full w-full", className)} aria-hidden>
      <defs>
        <pattern id={id} width="132" height="132" patternUnits="userSpaceOnUse">
          <g fill="currentColor">
            <path d="M66 30l10.6 25.4L102 66 76.6 76.6 66 102 55.4 76.6 30 66l25.4-10.6z" opacity=".55" />
            <rect x="48" y="48" width="36" height="36" transform="rotate(45 66 66)" opacity=".35" />
            <rect x="-9" y="-9" width="18" height="18" opacity=".45" />
            <rect x="123" y="-9" width="18" height="18" opacity=".45" />
            <rect x="-9" y="123" width="18" height="18" opacity=".45" />
            <rect x="123" y="123" width="18" height="18" opacity=".45" />
            <path d="M0 58l8 8-8 8M132 58l-8 8 8 8M58 0l8 8 8-8M58 132l8-8 8 8" opacity=".4" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/**
 * Architectural placeholder shown until the college uploads its own campus
 * photograph in Admin → Website → Hero. Deliberately calm and photographic in
 * tone (stone, arches, dome) rather than cartoon-like.
 */
export function CampusIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 800 560" className={className} preserveAspectRatio="xMaxYMax slice" aria-hidden>
      <defs>
        <linearGradient id="stone" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#e6e1d8" /><stop offset="1" stopColor="#d6cfc2" />
        </linearGradient>
        <linearGradient id="stoneDark" x1="0" x2="1">
          <stop offset="0" stopColor="#cfc7b9" /><stop offset="1" stopColor="#bfb6a6" />
        </linearGradient>
        <linearGradient id="dome" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#d9b56a" /><stop offset=".55" stopColor="#b98d3e" /><stop offset="1" stopColor="#8f6a2c" />
        </linearGradient>
        <linearGradient id="glass" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#5d5a52" /><stop offset="1" stopColor="#3b3934" />
        </linearGradient>
        <pattern id="tiles" width="28" height="14" patternUnits="userSpaceOnUse">
          <path d="M0 13.5h28M14 0v14" stroke="#c9c1b2" strokeWidth=".8" opacity=".55" />
        </pattern>
      </defs>
      {/* flag */}
      <line x1="530" y1="40" x2="530" y2="150" stroke="#8a8478" strokeWidth="2" />
      <path d="M530 44c14 6 26-6 40 2v26c-14-8-26 4-40-2z" fill="#e8691e" />
      {/* dome */}
      <path d="M448 210c0-58 37-92 82-92s82 34 82 92z" fill="url(#dome)" />
      <path d="M530 118v92M490 128c-8 24-10 54-8 82M570 128c8 24 10 54 8 82M462 160c40 8 96 8 136 0" stroke="#7d5b25" strokeWidth="1.2" fill="none" opacity=".5" />
      <rect x="440" y="206" width="180" height="16" fill="#cfc6b7" />
      {/* central tower */}
      <rect x="400" y="222" width="260" height="338" fill="url(#stone)" />
      <rect x="400" y="222" width="260" height="338" fill="url(#tiles)" />
      <rect x="392" y="222" width="276" height="14" fill="#d9d2c5" />
      <rect x="430" y="262" width="76" height="52" fill="url(#glass)" />
      <rect x="554" y="262" width="76" height="52" fill="url(#glass)" />
      <path d="M430 288h76M468 262v52M554 288h76M592 262v52" stroke="#7a5a3a" strokeWidth="2" />
      {/* arches on the tower */}
      {[0, 1].map((i) => (
        <g key={i} transform={`translate(${436 + i * 118} 360)`}>
          <path d="M0 200V70a35 35 0 0170 0v130z" fill="url(#glass)" />
          <path d="M0 200V70a35 35 0 0170 0v130" fill="none" stroke="#efeae1" strokeWidth="6" />
          <path d="M35 40v160M0 110h70M0 150h70" stroke="#6b4f33" strokeWidth="2" opacity=".8" />
        </g>
      ))}
      {/* left wing */}
      <rect x="0" y="318" width="400" height="242" fill="url(#stoneDark)" />
      <rect x="0" y="318" width="400" height="242" fill="url(#tiles)" />
      <rect x="0" y="306" width="408" height="14" fill="#d9d2c5" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} transform={`translate(${20 + i * 78} 380)`}>
          <path d="M0 180V58a28 28 0 0156 0v122z" fill="url(#glass)" />
          <path d="M0 180V58a28 28 0 0156 0v122" fill="none" stroke="#e8e2d7" strokeWidth="5" />
          <path d="M28 30v150M0 110h56" stroke="#6b4f33" strokeWidth="1.6" opacity=".7" />
        </g>
      ))}
      {/* right wing */}
      <rect x="660" y="318" width="140" height="242" fill="url(#stoneDark)" />
      <rect x="660" y="306" width="140" height="14" fill="#d9d2c5" />
      <g transform="translate(690 380)">
        <path d="M0 180V58a28 28 0 0156 0v122z" fill="url(#glass)" />
        <path d="M0 180V58a28 28 0 0156 0v122" fill="none" stroke="#e8e2d7" strokeWidth="5" />
      </g>
    </svg>
  );
}
