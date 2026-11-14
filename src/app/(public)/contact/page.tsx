import { Mail, MapPin, Phone } from "lucide-react";
import { PageHero, Container } from "@/components/site/section";
import { getSiteSettings } from "@/lib/data/site";
import { ContactForm } from "./form";

export const revalidate = 300;
export const metadata = { title: "Contact" };

export default async function ContactPage() {
  const s = await getSiteSettings();
  return (
    <>
      <PageHero eyebrow="Contact" title="Get in touch" description="Write to the school office, or visit us during working hours." />
      <Container className="grid gap-12 py-14 sm:py-20 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-6">
          {[
            { icon: MapPin, label: "Address", value: s.address },
            { icon: Phone, label: "Phone", value: s.phone, href: s.phone ? `tel:${s.phone}` : undefined },
            { icon: Mail, label: "Email", value: s.email, href: s.email ? `mailto:${s.email}` : undefined },
          ].map(({ icon: Icon, label, value, href }) => (
            <div key={label} className="flex gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-accent-50 text-accent"><Icon className="h-5 w-5" /></span>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-faint">{label}</p>
                {value ? (href ? <a href={href} className="mt-1 block text-[15px] hover:underline">{value}</a> : <p className="mt-1 text-[15px]">{value}</p>) : <p className="mt-1 text-sm text-muted">Not yet provided</p>}
              </div>
            </div>
          ))}
          {s.map_url && (
            <a href={s.map_url} target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-medium text-royal underline underline-offset-4">Open in maps</a>
          )}
        </div>
        <div className="rounded-md border border-line bg-paper p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold">Send a message</h2>
          <p className="mt-1 text-sm text-muted">Students and parents with an account should use their portal for faster, tracked responses.</p>
          <ContactForm />
        </div>
      </Container>
    </>
  );
}
