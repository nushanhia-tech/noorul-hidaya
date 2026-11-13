import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Emblem, GeoPattern } from "@/components/site/brand";
import { getSiteSettings } from "@/lib/data/site";
import { mediaUrl } from "@/lib/media";

export async function AuthShell({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  const s = await getSiteSettings();
  const logo = mediaUrl(s.logo_path);
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <aside className="relative hidden overflow-hidden bg-ink text-white lg:flex lg:flex-col lg:justify-between lg:p-14">
        <GeoPattern className="text-white/[0.035]" id="geo-auth" />
        <div className="absolute -right-24 bottom-0 h-[420px] w-[420px] rounded-full bg-accent/20 blur-3xl" aria-hidden />
        <Link href="/" className="relative flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo ? <img src={logo} alt="" className="h-11 w-auto" /> : <Emblem className="h-11 w-11" />}
          <span className="font-display text-lg font-semibold leading-tight">{s.college_name}</span>
        </Link>
        <div className="relative max-w-md">
          <p className="eyebrow text-accent-100">{s.motto}</p>
          <p className="display-xl mt-4 text-[44px]">One campus.<br />Five portals.<br />One record.</p>
          <p className="mt-6 text-[15px] leading-relaxed text-white/60">
            Students, faculty, parents, administrators and office staff sign in here. You will be taken to the portal your account is authorised for.
          </p>
        </div>
        <p className="relative text-xs text-white/40">Protected system. Access is logged and limited to authorised users.</p>
      </aside>
      <main className="flex flex-col bg-paper">
        <div className="flex items-center justify-between px-5 py-5 sm:px-10">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> Back to website
          </Link>
          <Link href="/" className="flex items-center gap-2 lg:hidden" aria-label={s.college_name}>
            <Emblem className="h-8 w-8" />
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 pb-16 sm:px-10">
          <div className="w-full max-w-[400px] animate-rise">
            <h1 className="font-display text-[30px] font-semibold tracking-[-0.03em]">{title}</h1>
            {description && <p className="mt-2 text-[15px] text-muted">{description}</p>}
            <div className="mt-8">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
