import Link from "next/link";
import { ArrowUpRight, BookOpen, Building2, CalendarDays, GraduationCap, MapPin } from "lucide-react";
import { GeoPattern, CampusIllustration } from "./brand";
import { HeroMedia } from "./hero-media";
import { mediaUrl } from "@/lib/media";
import type { HeroSlide } from "@/lib/data/public";
import type { SiteSettings } from "@/lib/data/site";

const QUICK_LINKS = [
  { label: "Programmes", href: "/programmes", icon: GraduationCap, primary: true },
  { label: "Departments", href: "/departments", icon: Building2 },
  { label: "Faculty", href: "/faculty", icon: BookOpen },
  { label: "Events", href: "/events", icon: CalendarDays },
];

export function Hero({ settings, slides }: { settings: SiteSettings; slides: HeroSlide[] }) {
  const first = slides[0];
  const images = slides.filter((s) => s.image_path).map((s) => ({ src: mediaUrl(s.image_path)!, alt: s.image_alt || s.title }));
  const title = first?.title || settings.college_name;
  return (
    <section className="relative overflow-hidden bg-ivory">
      <GeoPattern className="text-[#e7e3db] [mask-image:linear-gradient(to_right,transparent_30%,black_60%)]" id="geo-hero" />
      <div className="relative mx-auto grid max-w-[1440px] lg:min-h-[640px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="relative z-10 flex flex-col justify-center px-5 pb-10 pt-12 sm:px-8 sm:pt-16 lg:py-20 lg:pl-24 lg:pr-0">
          <p className="eyebrow mb-4 text-[15px] animate-rise">{first?.eyebrow || settings.motto}</p>
          <h1 className="display-xl max-w-[640px] text-[44px] text-ink animate-rise sm:text-[64px] lg:text-[76px]">
            {title}
            {!/[.!?]$/.test(title) && <span className="text-accent">.</span>}
          </h1>
          {(first?.subtitle || settings.intro) && (
            <p className="mt-6 max-w-[520px] text-base leading-relaxed text-muted animate-rise sm:text-[17px]">{first?.subtitle || settings.intro}</p>
          )}
          <nav aria-label="Quick links" className="mt-9 grid max-w-[560px] grid-cols-2 gap-2.5 animate-rise">
            {QUICK_LINKS.map(({ label, href, icon: Icon, primary }) => (
              <Link
                key={href} href={href}
                className={
                  primary
                    ? "group flex h-14 items-center gap-3 bg-accent px-4 text-[15px] font-medium text-white transition-colors hover:bg-accent-600 sm:h-16 sm:px-5 sm:text-[17px]"
                    : "group flex h-14 items-center gap-3 border border-line bg-white px-4 text-[15px] font-medium text-ink transition-colors hover:border-line-strong sm:h-16 sm:px-5 sm:text-[17px]"
                }
              >
                <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                <span className="flex-1">{label}</span>
                {primary && <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />}
              </Link>
            ))}
          </nav>
          {settings.address && (
            <p className="mt-10 flex items-center gap-2 text-sm text-muted lg:mt-14">
              <MapPin className="h-4 w-4 shrink-0" /> {settings.address}
            </p>
          )}
        </div>
        <div className="relative h-[300px] sm:h-[420px] lg:h-auto">
          {images.length ? (
            <HeroMedia images={images} />
          ) : (
            <div className="absolute inset-0">
              <CampusIllustration className="absolute bottom-0 right-0 h-full w-full" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-48 bg-gradient-to-r from-ivory to-transparent lg:block" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-ivory to-transparent lg:hidden" />
        </div>
      </div>
    </section>
  );
}
