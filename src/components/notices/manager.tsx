"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { F } from "@/components/ui/field";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { saveNotice, deleteNotice } from "@/app/portal/notices-actions";

type N = { id: string; title: string; body: string; category: string; audience: string[]; status: string; is_important: boolean; expires_on: string | null };
const AUD = [["public", "Public website"], ["student", "Students"], ["faculty", "Faculty"], ["parent", "Parents"], ["office", "Office staff"]];

export function NoticeForm({ n }: { n?: N }) {
  const [pending, start] = useTransition();
  return (
    <ActionForm action={saveNotice.bind(null, n?.id ?? null)} resetOnSuccess={!n} className="grid gap-4 sm:grid-cols-2">
      <F name="title" label="Title" required className="sm:col-span-2"><Input name="title" defaultValue={n?.title} required /></F>
      <F name="body" label="Text" className="sm:col-span-2"><Textarea name="body" rows={5} defaultValue={n?.body} /></F>
      <F name="category" label="Category"><Select name="category" defaultValue={n?.category ?? "general"}>{["general", "academic", "examination", "administrative", "fee", "event"].map((c) => <option key={c}>{c}</option>)}</Select></F>
      <F name="expires_on" label="Show until"><Input name="expires_on" type="date" defaultValue={n?.expires_on ?? ""} /></F>
      <fieldset className="sm:col-span-2">
        <legend className="mb-2 text-[13px] font-medium text-ink-soft">Audience</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">{AUD.map(([k, l]) => <Checkbox key={k} name="audience" value={k} label={l} defaultChecked={n ? n.audience.includes(k) : k !== "public"} />)}</div>
      </fieldset>
      <Checkbox name="is_important" defaultChecked={n?.is_important} label="Important announcement (highlighted)" />
      <F name="status" label="Status"><Select name="status" defaultValue={n?.status ?? "draft"}><option value="draft">Draft</option><option value="published">Publish now</option></Select></F>
      <div className="flex items-center justify-between sm:col-span-2">
        <SubmitButton variant="dark">{n ? "Save" : "Create notice"}</SubmitButton>
        {n && <Button variant="ghost" size="sm" disabled={pending} onClick={() => { if (confirm("Delete this notice?")) start(() => deleteNotice(n.id)); }}><Trash2 className="h-3.5 w-3.5 text-danger" /> Delete</Button>}
      </div>
    </ActionForm>
  );
}
