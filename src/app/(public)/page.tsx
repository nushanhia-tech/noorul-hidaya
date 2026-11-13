import Link from "next/link";
import { ArrowRight, ArrowUpRight, Mail, MapPin, Phone, Megaphone } from "lucide-react";
import { Hero } from "@/components/site/hero";
import { Container, Section, RichText } from "@/components/site/section";
import { NewsCard, EventRow } from "@/components/site/cards";
import { GeoPattern } from "@/components/site/brand";
import { getSiteSettings } from "@/lib/data/site";
import {
  getAchievements, getCalendar, getDepartments, getEvents, getFacultyDirectory, getGallery, getHeroSlides,
  getNews, getPage, getProgrammes, getPublicNotices,
} from "@/lib/data/public";
import { mediaUrl } from "@/lib/media";
import { formatDate, humanize, todayISO } from "@/lib/format";
import { Avatar } from "@/components/ui/misc";

export const revalidate = 300;

export default async function HomePage() {
  const [settings, slides, about, departments, programmes, achievements, notices, news, events, gallery, calendar, faculty] =
    await Promise.all([
      getSiteSettings(), getHeroSlides(), getPage("about"), getDepartments(), getProgrammes(), getAchievements(),
      getPublicNotices(6), getNews(3), getEvents("upcoming", 4), getGallery(8), getCalendar(todayISO(), 6), getFacultyDirectory(),
    ]);
  const order = settings.home_sections;
  const featuredFaculty = [...faculty.filter((f) => f.is_hod), ...faculty.filter((f) => !f.is_hod)].slice(0, 4);

  const sections: Record<string, React.ReactNode> = {
    intro: (
      <section key="intro" className="border-b border-line bg-paper py-16 sm:py-24">
        <Container className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
          <div>
            <p className="eyebrow mb-3">About the institution</p>
            <h2 className="font-display text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[42px]">
              {about?.title && about.title !== "About the College" ? about.title : `A college shaped by learning and values.`}
            </h2>
            {settings.established_year && (
              <p className="mt-6 inline-flex items-center gap-3 text-sm text-muted">
                <span className="h-px w-10 bg-accent" /> Established {settings.established_year}
              </p>
            )}
          </div>
          <div>
            {about?.summary || about?.body ? (
              <RichText text={about.summary || about.body.slice(0, 900)} className="text-[17px]" />
            ) : (
              <p className="text-[17px] leading-relaxed text-muted">
                The college introduction is written in Admin → Website → Pages → About.
              </p>
            )}
            <Link href="/about" className="group mt-7 inline-flex items-center gap-1.5 text-sm font-medium text-ink">
              More about the college <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </Container>
      </section>
    ),
    departments: departments.length > 0 && (
      <Section key="departments" eyebrow="Departments" title="Schools of thought, under one roof." description="Each department brings its own scholarly tradition, faculty and programmes." link={{ href: "/departments", label: "All departments" }}>
        <div className="grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {departments.slice(0, 6).map((d, i) => (
            <Link key={d.id} href={`/departments/${d.slug}`} className="group relative flex min-h-[190px] flex-col justify-between bg-paper p-6 transition-colors hover:bg-white sm:p-7">
              <span className="tabular text-xs font-medium text-faint">{String(i + 1).padStart(2, "0")} — {d.code}</span>
              <div>
                <h3 className="font-display text-xl font-semibold tracking-tight text-ink">{d.name}</h3>
                {d.summary && <p className="mt-2 line-clamp-2 text-sm text-muted">{d.summary}</p>}
              </div>
              <ArrowUpRight className="absolute right-6 top-6 h-5 w-5 text-faint transition-colors group-hover:text-accent" />
            </Link>
          ))}
        </div>
      </Section>
    ),
    programmes: programmes.length > 0 && (
      <Section key="programmes" tone="paper" eyebrow="Academic programmes" title="Programmes of study" link={{ href: "/programmes", label: "Explore programmes" }}>
        <ul className="divide-y divide-line border-y border-line">
          {programmes.slice(0, 8).map((p) => (
            <li key={p.id}>
              <Link href={`/programmes/${p.slug}`} className="group grid items-center gap-2 py-5 sm:grid-cols-[90px_1fr_auto] sm:gap-6">
                <span className="text-xs font-semibold uppercase tracking-wider text-accent">{p.level}</span>
                <span>
                  <span className="block font-display text-lg font-semibold tracking-tight text-ink group-hover:underline sm:text-xl">{p.name}</span>
                  {p.departments?.name && <span className="text-sm text-muted">{p.departments.name}</span>}
                </span>
                <span className="text-sm text-muted">{p.duration_semesters / 2} years · {p.duration_semesters} semesters</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    ),
    achievements: achievements.length > 0 && (
      <section key="achievements" className="relative overflow-hidden bg-ink py-16 text-white sm:py-20">
        <GeoPattern className="text-white/[0.03]" id="geo-ach" />
        <Container className="relative">
          <p className="eyebrow mb-3 text-accent-100">Achievements</p>
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {achievements.slice(0, 4).map((a) => (
              <div key={a.id} className="border-t border-white/15 pt-5">
                <p className="font-display text-5xl font-semibold tracking-[-0.04em]">{a.figure}</p>
                <p className="mt-2 text-[15px] font-medium">{a.label}</p>
                {a.description && <p className="mt-1 text-sm text-white/55">{a.description}</p>}
              </div>
            ))}
          </div>
        </Container>
      </section>
    ),
    announcements: notices.length > 0 && (
      <Section key="announcements" eyebrow="Announcements" title="Important notices" link={{ href: "/news#notices", label: "All notices" }}>
        <ul className="grid gap-3 md:grid-cols-2">
          {notices.slice(0, 6).map((n) => (
            <li key={n.id} className="flex gap-4 rounded-md border border-line bg-paper p-5">
              <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm ${n.is_important ? "bg-accent-50 text-accent" : "bg-sand text-ink-soft"}`}>
                <Megaphone className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-faint">{formatDate(n.published_at)} · {humanize(n.category)}</p>
                <p className="mt-1 font-medium leading-snug text-ink">{n.title}</p>
                {n.body && <p className="mt-1 line-clamp-2 text-sm text-muted">{n.body}</p>}
              </div>
            </li>
          ))}
        </ul>
      </Section>
    ),
    news: news.items.length > 0 && (
      <Section key="news" tone="paper" eyebrow="Latest news" title="From the campus" link={{ href: "/news", label: "All news" }}>
        <div className="grid gap-5 md:grid-cols-3">
          {news.items.map((n) => <NewsCard key={n.id} item={n} />)}
        </div>
      </Section>
    ),
    events: events.length > 0 && (
      <Section key="events" eyebrow="Upcoming events" title="On the calendar" link={{ href: "/events", label: "All events" }}>
        <div className="grid gap-x-12 md:grid-cols-2">
          {events.map((e) => <EventRow key={e.id} event={e} />)}
        </div>
      </Section>
    ),
    gallery: gallery.length > 0 && (
      <Section key="gallery" tone="paper" eyebrow="Campus life" title="Life at the college" link={{ href: "/gallery", label: "Open gallery" }}>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {gallery.slice(0, 8).map((g, i) => (
            <figure key={g.id} className={`group relative overflow-hidden rounded-sm bg-sand ${i === 0 ? "col-span-2 row-span-2 aspect-square md:aspect-auto" : "aspect-square"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(g.image_path)!} alt={g.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent p-3 text-[13px] text-white opacity-0 transition-opacity group-hover:opacity-100">{g.title}</figcaption>
            </figure>
          ))}
        </div>
      </Section>
    ),
    calendar: calendar.length > 0 && (
      <Section key="calendar" eyebrow="Academic calendar" title="Dates to remember" link={{ href: "/calendar", label: "Full calendar" }}>
        <ol className="grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {calendar.map((c) => (
            <li key={c.id} className="bg-paper p-5">
              <p className="tabular text-sm font-medium text-accent">
                {formatDate(c.starts_on, { day: "numeric", month: "short" })}{c.ends_on && c.ends_on !== c.starts_on ? ` – ${formatDate(c.ends_on, { day: "numeric", month: "short" })}` : ""}
              </p>
              <p className="mt-1.5 font-medium text-ink">{c.title}</p>
              <p className="mt-0.5 text-xs text-faint">{humanize(c.category)}</p>
            </li>
          ))}
        </ol>
      </Section>
    ),
    faculty: featuredFaculty.length > 0 && (
      <Section key="faculty" tone="paper" eyebrow="Faculty" title="Teachers and scholars" link={{ href: "/faculty", label: "Faculty directory" }}>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featuredFaculty.map((f) => (
            <div key={f.id} className="rounded-md border border-line bg-white p-5">
              <Avatar name={f.full_name} src={mediaUrl(f.photo_path)} size={56} />
              <p className="mt-4 font-display text-[17px] font-semibold tracking-tight">{f.full_name}</p>
              <p className="text-sm text-muted">{f.designation}{f.is_hod ? " · Head of Department" : ""}</p>
              <p className="mt-3 text-xs text-faint">{f.department_name}</p>
            </div>
          ))}
        </div>
      </Section>
    ),
    contact: (
      <section key="contact" className="border-t border-line bg-ivory py-16 sm:py-20">
        <Container className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <p className="eyebrow mb-3">Visit or write to us</p>
            <h2 className="font-display text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[40px]">We would be glad to hear from you.</h2>
            <Link href="/contact" className="mt-7 inline-flex h-12 items-center gap-2 bg-ink px-5 text-[15px] font-medium text-white hover:bg-ink-soft">
              Contact the college <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          <ul className="space-y-4 text-[15px]">
            {settings.address && <li className="flex gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-accent" /> {settings.address}</li>}
            {settings.phone && <li className="flex gap-3"><Phone className="mt-0.5 h-5 w-5 shrink-0 text-accent" /> <a href={`tel:${settings.phone}`}>{settings.phone}</a></li>}
            {settings.email && <li className="flex gap-3"><Mail className="mt-0.5 h-5 w-5 shrink-0 text-accent" /> <a href={`mailto:${settings.email}`}>{settings.email}</a></li>}
          </ul>
        </Container>
      </section>
    ),
  };

  return (
    <>
      <Hero settings={settings} slides={slides} />
      {order.map((key) => sections[key] ?? null)}
    </>
  );
}
