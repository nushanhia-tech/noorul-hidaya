import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GeoPattern } from "./brand";
import { cn } from "@/lib/utils";

export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1280px] px-5 sm:px-8", className)}>{children}</div>;
}

export function Section({
  eyebrow, title, description, link, className, children, tone = "plain",
}: { eyebrow?: string; title: string; description?: string; link?: { href: string; label: string }; className?: string; children: React.ReactNode; tone?: "plain" | "paper" }) {
  return (
    <section className={cn("py-16 sm:py-20 lg:py-24", tone === "paper" && "bg-paper", className)}>
      <Container>
        <div className="mb-9 flex flex-col gap-4 sm:mb-12 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
            <h2 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink sm:text-4xl">{title}</h2>
            {description && <p className="mt-3 text-[15px] leading-relaxed text-muted sm:text-base">{description}</p>}
          </div>
          {link && (
            <Link href={link.href} className="group inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-ink">
              {link.label} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
        {children}
      </Container>
    </section>
  );
}

export function PageHero({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description?: string; children?: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden border-b border-line bg-ivory">
      <GeoPattern className="text-sand [mask-image:linear-gradient(to_left,black,transparent_75%)]" id="geo-page" />
      <Container className="relative py-14 sm:py-20">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h1 className="display-xl max-w-3xl text-[40px] text-ink sm:text-[56px]">{title}</h1>
        {description && <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">{description}</p>}
        {children}
      </Container>
    </section>
  );
}

/** Safe, minimal text formatting for CMS bodies: paragraphs, ## headings, - lists, **bold**. No raw HTML. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className={cn("prose-college", className)}>
      {blocks.map((b, i) => {
        if (b.startsWith("### ")) return <h3 key={i}>{inline(b.slice(4))}</h3>;
        if (b.startsWith("## ")) return <h2 key={i}>{inline(b.slice(3))}</h2>;
        if (/^[-*] /m.test(b) && b.split("\n").every((l) => /^[-*] /.test(l))) {
          return <ul key={i}>{b.split("\n").map((l, j) => <li key={j}>{inline(l.slice(2))}</li>)}</ul>;
        }
        return <p key={i}>{b.split("\n").map((l, j, arr) => <span key={j}>{inline(l)}{j < arr.length - 1 && <br />}</span>)}</p>;
      })}
    </div>
  );
}

function inline(s: string): React.ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong> : part,
  );
}

export function SetupNotice() {
  return (
    <Container className="py-6">
      <div className="rounded-sm border border-warning/25 bg-warning-50 px-4 py-3 text-[13px] text-warning">
        <strong>Setup required:</strong> this site is not yet connected to its database. Configure Supabase as described in the README to load school content.
      </div>
    </Container>
  );
}
