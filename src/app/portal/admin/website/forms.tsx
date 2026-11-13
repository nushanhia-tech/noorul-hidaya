"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { F } from "@/components/ui/field";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/misc";
import { deleteContent, saveContent, savePage, type CmsType } from "./actions";

type D = Record<string, unknown> | undefined;
const v = (d: D, k: string, f: string | number = "") => (d?.[k] ?? f) as string;
const dtLocal = (iso: unknown) => (iso ? new Date(iso as string).toISOString().slice(0, 16) : "");
const BODY_HINT = "Blank line = new paragraph · ## Heading · - list item · **bold**";

function StatusSelect({ d }: { d: D }) {
  return <F name="status" label="Status"><Select name="status" defaultValue={v(d, "status", "draft")}><option value="draft">Draft (hidden)</option><option value="published">Published</option></Select></F>;
}
function ImageField({ label = "Image", required }: { label?: string; required?: boolean }) {
  return <F name="image" label={label} hint="PNG, JPG or WEBP · max 5 MB" required={required}><Input name="image" type="file" accept="image/png,image/jpeg,image/webp" /></F>;
}

function Remove({ type, id }: { type: CmsType; id: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => { if (confirm("Delete permanently?")) start(async () => { const r = await deleteContent(type, id); if (!r.ok) setErr(r.error); }); }}>
        <Trash2 className="h-3.5 w-3.5 text-danger" /> Delete
      </Button>
      {err && <Notice tone="danger">{err}</Notice>}
    </>
  );
}

export function ContentForm({ type, d, id }: { type: CmsType; d?: D; id?: string }) {
  const fields: Record<CmsType, React.ReactNode> = {
    hero: <>
      <F name="title" label="Headline" required className="sm:col-span-2"><Input name="title" defaultValue={v(d, "title")} required /></F>
      <F name="eyebrow" label="Eyebrow / motto"><Input name="eyebrow" defaultValue={v(d, "eyebrow")} /></F>
      <F name="image_alt" label="Image description (alt text)"><Input name="image_alt" defaultValue={v(d, "image_alt")} /></F>
      <F name="subtitle" label="Introduction" className="sm:col-span-2"><Textarea name="subtitle" rows={2} defaultValue={v(d, "subtitle")} /></F>
      <ImageField label="Campus photograph" /><F name="sort_order" label="Order"><Input name="sort_order" type="number" defaultValue={v(d, "sort_order", 0)} /></F>
      <StatusSelect d={d} />
    </>,
    news: <>
      <F name="title" label="Title" required className="sm:col-span-2"><Input name="title" defaultValue={v(d, "title")} required /></F>
      <F name="excerpt" label="Excerpt" className="sm:col-span-2"><Textarea name="excerpt" rows={2} defaultValue={v(d, "excerpt")} /></F>
      <F name="body" label="Article" hint={BODY_HINT} className="sm:col-span-2"><Textarea name="body" rows={10} defaultValue={v(d, "body")} /></F>
      <ImageField label="Cover image" /><F name="slug" label="URL slug" hint="Generated from the title if blank"><Input name="slug" defaultValue={v(d, "slug")} /></F>
      <StatusSelect d={d} /><F name="published_at" label="Publish date"><Input name="published_at" type="datetime-local" defaultValue={dtLocal(d?.published_at)} /></F>
    </>,
    event: <>
      <F name="title" label="Title" required className="sm:col-span-2"><Input name="title" defaultValue={v(d, "title")} required /></F>
      <F name="starts_at" label="Starts" required><Input name="starts_at" type="datetime-local" defaultValue={dtLocal(d?.starts_at)} required /></F>
      <F name="ends_at" label="Ends"><Input name="ends_at" type="datetime-local" defaultValue={dtLocal(d?.ends_at)} /></F>
      <F name="venue" label="Venue"><Input name="venue" defaultValue={v(d, "venue")} /></F>
      <F name="slug" label="URL slug"><Input name="slug" defaultValue={v(d, "slug")} /></F>
      <F name="summary" label="Summary" className="sm:col-span-2"><Input name="summary" defaultValue={v(d, "summary")} /></F>
      <F name="description" label="Description" hint={BODY_HINT} className="sm:col-span-2"><Textarea name="description" rows={6} defaultValue={v(d, "description")} /></F>
      <ImageField label="Cover image" /><StatusSelect d={d} />
    </>,
    gallery: <>
      <F name="title" label="Title" required><Input name="title" defaultValue={v(d, "title")} required /></F>
      <F name="album" label="Album"><Input name="album" defaultValue={v(d, "album", "Campus")} /></F>
      <F name="caption" label="Caption" className="sm:col-span-2"><Input name="caption" defaultValue={v(d, "caption")} /></F>
      <ImageField label="Photograph" required={!id} /><F name="sort_order" label="Order"><Input name="sort_order" type="number" defaultValue={v(d, "sort_order", 0)} /></F>
      <StatusSelect d={d ?? { status: "published" }} />
    </>,
    achievement: <>
      <F name="figure" label="Figure" required hint="e.g. 42 or 98%"><Input name="figure" defaultValue={v(d, "figure")} required /></F>
      <F name="label" label="Label" required><Input name="label" defaultValue={v(d, "label")} required /></F>
      <F name="description" label="Description" className="sm:col-span-2"><Input name="description" defaultValue={v(d, "description")} /></F>
      <F name="sort_order" label="Order"><Input name="sort_order" type="number" defaultValue={v(d, "sort_order", 0)} /></F>
      <Checkbox name="is_published" defaultChecked={d ? Boolean(d.is_published) : true} label="Published" />
    </>,
    leader: <>
      <F name="name" label="Name" required><Input name="name" defaultValue={v(d, "name")} required /></F>
      <F name="designation" label="Designation" required><Input name="designation" defaultValue={v(d, "designation")} required /></F>
      <F name="message" label="Message" className="sm:col-span-2"><Textarea name="message" rows={4} defaultValue={v(d, "message")} /></F>
      <ImageField label="Photo" /><F name="sort_order" label="Order"><Input name="sort_order" type="number" defaultValue={v(d, "sort_order", 0)} /></F>
      <Checkbox name="is_published" defaultChecked={d ? Boolean(d.is_published) : true} label="Published" />
    </>,
    calendar: <>
      <F name="title" label="Title" required className="sm:col-span-2"><Input name="title" defaultValue={v(d, "title")} required /></F>
      <F name="category" label="Category"><Select name="category" defaultValue={v(d, "category", "event")}>{["term", "examination", "holiday", "event", "deadline", "result"].map((c) => <option key={c}>{c}</option>)}</Select></F>
      <div />
      <F name="starts_on" label="From" required><Input name="starts_on" type="date" defaultValue={v(d, "starts_on")} required /></F>
      <F name="ends_on" label="To"><Input name="ends_on" type="date" defaultValue={v(d, "ends_on")} /></F>
      <F name="description" label="Description" className="sm:col-span-2"><Input name="description" defaultValue={v(d, "description")} /></F>
      <Checkbox name="is_public" defaultChecked={d ? Boolean(d.is_public) : true} label="Show on the public website" />
    </>,
  };
  return (
    <ActionForm action={saveContent.bind(null, type, id ?? null)} resetOnSuccess={!id} className="grid gap-4 sm:grid-cols-2">
      {fields[type]}
      <div className="flex items-center justify-between gap-3 sm:col-span-2">
        <SubmitButton variant="dark" pendingLabel="Saving…">{id ? "Save" : "Add"}</SubmitButton>
        {id && <Remove type={type} id={id} />}
      </div>
    </ActionForm>
  );
}

export function PageForm({ slug, d }: { slug: string; d?: D }) {
  return (
    <ActionForm action={savePage.bind(null, slug)} className="grid gap-4">
      <F name="title" label="Title" required><Input name="title" defaultValue={v(d, "title")} required /></F>
      <F name="summary" label="Summary / introduction" hint="Shown under the page title and on the homepage (About)."><Textarea name="summary" rows={3} defaultValue={v(d, "summary")} /></F>
      <F name="body" label="Body" hint={BODY_HINT}><Textarea name="body" rows={12} defaultValue={v(d, "body")} /></F>
      <div className="grid gap-4 sm:grid-cols-2"><ImageField label="Side image" /><StatusSelect d={d} /></div>
      <div><SubmitButton variant="dark">Save page</SubmitButton></div>
    </ActionForm>
  );
}
