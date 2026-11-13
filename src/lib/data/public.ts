import "server-only";
import { createPublicClient } from "@/lib/supabase/server";

/** Read-only public content (anon role; RLS only exposes published rows). */
function db() {
  return createPublicClient();
}
const empty = <T,>(): T[] => [];

export async function getHeroSlides() {
  const c = db(); if (!c) return empty<HeroSlide>();
  const { data } = await c.from("hero_slides").select("*").eq("status", "published").order("sort_order");
  return (data ?? []) as HeroSlide[];
}
export type HeroSlide = { id: string; eyebrow: string; title: string; subtitle: string; image_path: string | null; image_alt: string };

export type Department = { id: string; code: string; name: string; slug: string; summary: string; description: string; image_path: string | null; established_year: number | null };
export async function getDepartments() {
  const c = db(); if (!c) return empty<Department>();
  const { data } = await c.from("departments").select("id, code, name, slug, summary, description, image_path, established_year").order("sort_order").order("name");
  return (data ?? []) as Department[];
}
export async function getDepartment(slug: string) {
  const c = db(); if (!c) return null;
  const { data } = await c.from("departments").select("*").eq("slug", slug).maybeSingle();
  if (!data) return null;
  const [{ data: programmes }, { data: faculty }] = await Promise.all([
    c.from("programmes").select("id, name, slug, level, duration_semesters, summary").eq("department_id", data.id).order("level").order("name"),
    c.from("public_faculty_directory").select("*").eq("department_id", data.id).order("is_hod", { ascending: false }).order("sort_order"),
  ]);
  return { department: data as Department, programmes: (programmes ?? []) as Programme[], faculty: (faculty ?? []) as FacultyMember[] };
}

export type Programme = { id: string; name: string; slug: string; level: string; duration_semesters: number; summary: string; description?: string; eligibility?: string; intake?: number | null; code?: string; departments?: { name: string; slug: string } | null };
export async function getProgrammes() {
  const c = db(); if (!c) return empty<Programme>();
  const { data } = await c.from("programmes").select("id, code, name, slug, level, duration_semesters, summary, intake, departments(name, slug)").order("level").order("name");
  return (data ?? []) as unknown as Programme[];
}
export async function getProgramme(slug: string) {
  const c = db(); if (!c) return null;
  const { data } = await c.from("programmes").select("*, departments(name, slug)").eq("slug", slug).maybeSingle();
  if (!data) return null;
  const { data: courses } = await c.from("courses").select("code, title, credits, semester_number, course_type").eq("programme_id", data.id).order("semester_number").order("code");
  return { programme: data as unknown as Programme, courses: (courses ?? []) as { code: string; title: string; credits: number; semester_number: number | null; course_type: string }[] };
}

export type FacultyMember = { id: string; full_name: string; designation: string; qualification: string; specialization: string; bio: string; photo_path: string | null; is_hod: boolean; department_name: string; department_slug: string; department_id: string };
export async function getFacultyDirectory(departmentSlug?: string, q?: string) {
  const c = db(); if (!c) return empty<FacultyMember>();
  let query = c.from("public_faculty_directory").select("*").order("department_name").order("is_hod", { ascending: false }).order("sort_order").order("full_name");
  if (departmentSlug) query = query.eq("department_slug", departmentSlug);
  if (q) query = query.ilike("full_name", `%${q.replace(/[%_,()]/g, "")}%`);
  const { data } = await query;
  return (data ?? []) as FacultyMember[];
}

export type NewsItem = { id: string; title: string; slug: string; excerpt: string; body: string; cover_path: string | null; published_at: string };
export async function getNews(limit = 12, offset = 0) {
  const c = db(); if (!c) return { items: empty<NewsItem>(), total: 0 };
  const { data, count } = await c.from("news").select("id, title, slug, excerpt, cover_path, published_at", { count: "exact" })
    .eq("status", "published").order("published_at", { ascending: false }).range(offset, offset + limit - 1);
  return { items: (data ?? []) as NewsItem[], total: count ?? 0 };
}
export async function getNewsItem(slug: string) {
  const c = db(); if (!c) return null;
  const { data } = await c.from("news").select("*").eq("slug", slug).eq("status", "published").maybeSingle();
  return data as NewsItem | null;
}

export type EventItem = { id: string; title: string; slug: string; summary: string; description: string; venue: string; starts_at: string; ends_at: string | null; cover_path: string | null };
export async function getEvents(when: "upcoming" | "past" = "upcoming", limit = 24) {
  const c = db(); if (!c) return empty<EventItem>();
  const now = new Date().toISOString();
  let q = c.from("events").select("*").eq("status", "published");
  q = when === "upcoming" ? q.gte("starts_at", now).order("starts_at") : q.lt("starts_at", now).order("starts_at", { ascending: false });
  const { data } = await q.limit(limit);
  return (data ?? []) as EventItem[];
}
export async function getEvent(slug: string) {
  const c = db(); if (!c) return null;
  const { data } = await c.from("events").select("*").eq("slug", slug).eq("status", "published").maybeSingle();
  return data as EventItem | null;
}

export type GalleryItem = { id: string; title: string; caption: string; album: string; image_path: string };
export async function getGallery(limit = 60) {
  const c = db(); if (!c) return empty<GalleryItem>();
  const { data } = await c.from("gallery_items").select("id, title, caption, album, image_path").eq("status", "published").order("sort_order").order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as GalleryItem[];
}

export type CalendarEntry = { id: string; title: string; description: string; category: string; starts_on: string; ends_on: string | null };
export async function getCalendar(fromDate?: string, limit = 200) {
  const c = db(); if (!c) return empty<CalendarEntry>();
  let q = c.from("calendar_entries").select("id, title, description, category, starts_on, ends_on").order("starts_on");
  if (fromDate) q = q.gte("starts_on", fromDate);
  const { data } = await q.limit(limit);
  return (data ?? []) as CalendarEntry[];
}

export type PublicNotice = { id: string; title: string; body: string; category: string; is_important: boolean; published_at: string };
export async function getPublicNotices(limit = 20) {
  const c = db(); if (!c) return empty<PublicNotice>();
  const { data } = await c.from("notices").select("id, title, body, category, is_important, published_at").order("is_important", { ascending: false }).order("published_at", { ascending: false }).limit(limit);
  return (data ?? []) as PublicNotice[];
}

export type SitePage = { slug: string; title: string; summary: string; body: string; image_path: string | null };
export async function getPage(slug: string) {
  const c = db(); if (!c) return null;
  const { data } = await c.from("site_pages").select("slug, title, summary, body, image_path").eq("slug", slug).maybeSingle();
  return data as SitePage | null;
}

export type Leader = { id: string; name: string; designation: string; message: string; photo_path: string | null };
export async function getLeadership() {
  const c = db(); if (!c) return empty<Leader>();
  const { data } = await c.from("leadership").select("id, name, designation, message, photo_path").order("sort_order");
  return (data ?? []) as Leader[];
}

export type Achievement = { id: string; figure: string; label: string; description: string };
export async function getAchievements() {
  const c = db(); if (!c) return empty<Achievement>();
  const { data } = await c.from("achievements").select("id, figure, label, description").order("sort_order");
  return (data ?? []) as Achievement[];
}
