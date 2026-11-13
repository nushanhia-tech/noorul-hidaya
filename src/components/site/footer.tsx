import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { Emblem } from "./brand";
import type { SiteSettings } from "@/lib/data/site";

export function SiteFooter({ settings }: { settings: SiteSettings }) {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-ink text-white/80">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-14 sm:px-8 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:py-16">
        <div>
          <div className="flex items-center gap-3">
            <Emblem className="h-10 w-10" />
            <p className="font-display text-lg font-semibold leading-tight text-white">{settings.college_name}</p>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/60">{settings.footer_text || settings.motto}</p>
          {settings.affiliation && <p className="mt-3 text-xs text-white/45">{settings.affiliation}</p>}
        </div>
        <FooterCol title="Institution" links={[["About", "/about"], ["Mission & Vision", "/about/mission-vision"], ["Administration", "/about/administration"], ["Departments", "/departments"], ["Faculty Directory", "/faculty"]]} />
        <FooterCol title="Academics" links={[["Programmes", "/programmes"], ["Academic Calendar", "/calendar"], ["News & Notices", "/news"], ["Events", "/events"], ["Gallery", "/gallery"]]} />
        <div>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-white/45">Contact</h2>
          <ul className="space-y-3 text-sm">
            {settings.address && <li className="flex gap-2.5"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> <span>{settings.address}</span></li>}
            {settings.phone && <li className="flex gap-2.5"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> <a href={`tel:${settings.phone}`} className="hover:text-white">{settings.phone}</a></li>}
            {settings.email && <li className="flex gap-2.5"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> <a href={`mailto:${settings.email}`} className="hover:text-white">{settings.email}</a></li>}
            {!settings.address && !settings.phone && !settings.email && <li className="text-white/45">Contact details are added in Admin → Settings.</li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-2 px-5 py-5 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© {year} {settings.college_name}. All rights reserved.</p>
          <div className="flex gap-5">
            <Link href="/contact" className="hover:text-white">Contact</Link>
            <Link href="/login" className="hover:text-white">Portal Login</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-white/45">{title}</h2>
      <ul className="space-y-2.5 text-sm">
        {links.map(([label, href]) => (
          <li key={href}><Link href={href} className="hover:text-white">{label}</Link></li>
        ))}
      </ul>
    </div>
  );
}
