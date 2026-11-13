"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { F } from "@/components/ui/field";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/misc";
import { saveEntity, deleteEntity } from "./academic-actions";

type D = Record<string, unknown> | undefined;
type Opt = { id: string; name?: string; label?: string; code?: string; title?: string };
const v = (d: D, k: string, fallback: string | number = "") => (d?.[k] ?? fallback) as string;

/** Expandable row with an inline edit form. */
export function EditRow({ summary, children }: { summary: React.ReactNode; children: React.ReactNode }) {
  return (
    <details className="group border-b border-line last:border-0">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 hover:bg-white [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">{summary}</div>
        <ChevronDown className="h-4 w-4 shrink-0 text-faint transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-line bg-ivory px-5 py-5">{children}</div>
    </details>
  );
}

export function DeleteButton({ kind, id, label = "Delete" }: { kind: Parameters<typeof deleteEntity>[0]; id: string; label?: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => {
        if (!confirm("Delete this record? This cannot be undone.")) return;
        start(async () => { const r = await deleteEntity(kind, id); setErr(r.ok ? null : r.error); });
      }}><Trash2 className="h-3.5 w-3.5 text-danger" /> {label}</Button>
      {err && <Notice tone="danger" className="mt-2">{err}</Notice>}
    </div>
  );
}

function Actions({ id, kind }: { id?: string; kind: Parameters<typeof deleteEntity>[0] }) {
  return (
    <div className="flex items-center justify-between gap-3 sm:col-span-2">
      <SubmitButton variant="dark">{id ? "Save changes" : "Create"}</SubmitButton>
      {id && <DeleteButton kind={kind} id={id} />}
    </div>
  );
}

export function DepartmentForm({ d, id }: { d?: D; id?: string }) {
  return (
    <ActionForm action={saveEntity.bind(null, "department", id ?? null)} resetOnSuccess={!id} className="grid gap-4 sm:grid-cols-2">
      <F name="name" label="Name" required><Input name="name" defaultValue={v(d, "name")} required /></F>
      <F name="code" label="Code" required hint="e.g. ARB"><Input name="code" defaultValue={v(d, "code")} required /></F>
      <F name="summary" label="Summary" className="sm:col-span-2"><Input name="summary" defaultValue={v(d, "summary")} /></F>
      <F name="description" label="Description" className="sm:col-span-2" hint="Paragraphs separated by blank lines; ## for headings; - for lists."><Textarea name="description" rows={5} defaultValue={v(d, "description")} /></F>
      <F name="established_year" label="Established"><Input name="established_year" type="number" defaultValue={v(d, "established_year")} /></F>
      <F name="sort_order" label="Display order"><Input name="sort_order" type="number" defaultValue={v(d, "sort_order", 0)} /></F>
      <Checkbox name="is_published" defaultChecked={d ? Boolean(d.is_published) : true} label="Published on the website" />
      <Actions id={id} kind="department" />
    </ActionForm>
  );
}

export function ProgrammeForm({ d, id, departments }: { d?: D; id?: string; departments: Opt[] }) {
  return (
    <ActionForm action={saveEntity.bind(null, "programme", id ?? null)} resetOnSuccess={!id} className="grid gap-4 sm:grid-cols-2">
      <F name="name" label="Name" required><Input name="name" defaultValue={v(d, "name")} required /></F>
      <F name="code" label="Code" required><Input name="code" defaultValue={v(d, "code")} required /></F>
      <F name="department_id" label="Department" required><Select name="department_id" defaultValue={v(d, "department_id")} required><option value="" disabled>Choose</option>{departments.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></F>
      <F name="level" label="Level"><Select name="level" defaultValue={v(d, "level", "UG")}>{["UG", "PG", "Diploma", "Certificate", "Doctoral"].map((l) => <option key={l}>{l}</option>)}</Select></F>
      <F name="duration_semesters" label="Semesters"><Input name="duration_semesters" type="number" min={1} max={12} defaultValue={v(d, "duration_semesters", 6)} /></F>
      <F name="intake" label="Annual intake"><Input name="intake" type="number" defaultValue={v(d, "intake")} /></F>
      <F name="summary" label="Summary" className="sm:col-span-2"><Input name="summary" defaultValue={v(d, "summary")} /></F>
      <F name="description" label="Description" className="sm:col-span-2"><Textarea name="description" rows={4} defaultValue={v(d, "description")} /></F>
      <F name="eligibility" label="Eligibility" className="sm:col-span-2"><Textarea name="eligibility" rows={2} defaultValue={v(d, "eligibility")} /></F>
      <Checkbox name="is_published" defaultChecked={d ? Boolean(d.is_published) : true} label="Published on the website" />
      <Actions id={id} kind="programme" />
    </ActionForm>
  );
}

export function CourseForm({ d, id, departments, programmes }: { d?: D; id?: string; departments: Opt[]; programmes: Opt[] }) {
  return (
    <ActionForm action={saveEntity.bind(null, "course", id ?? null)} resetOnSuccess={!id} className="grid gap-4 sm:grid-cols-2">
      <F name="title" label="Title" required><Input name="title" defaultValue={v(d, "title")} required /></F>
      <F name="code" label="Code" required><Input name="code" defaultValue={v(d, "code")} required /></F>
      <F name="department_id" label="Department" required><Select name="department_id" defaultValue={v(d, "department_id")} required><option value="" disabled>Choose</option>{departments.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></F>
      <F name="programme_id" label="Programme"><Select name="programme_id" defaultValue={v(d, "programme_id")}><option value="">Shared / none</option>{programmes.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></F>
      <F name="credits" label="Credits"><Input name="credits" type="number" step="0.5" defaultValue={v(d, "credits", 4)} /></F>
      <F name="semester_number" label="Semester"><Input name="semester_number" type="number" min={1} max={12} defaultValue={v(d, "semester_number")} /></F>
      <F name="course_type" label="Type"><Select name="course_type" defaultValue={v(d, "course_type", "core")}>{["core", "elective", "common", "language", "practical"].map((t) => <option key={t}>{t}</option>)}</Select></F>
      <F name="description" label="Description" className="sm:col-span-2"><Textarea name="description" rows={2} defaultValue={v(d, "description")} /></F>
      <Checkbox name="is_active" defaultChecked={d ? Boolean(d.is_active) : true} label="Active" />
      <Actions id={id} kind="course" />
    </ActionForm>
  );
}

export function YearForm({ d, id }: { d?: D; id?: string }) {
  return (
    <ActionForm action={saveEntity.bind(null, "year", id ?? null)} resetOnSuccess={!id} className="grid gap-4 sm:grid-cols-2">
      <F name="label" label="Label" required hint="e.g. 2026-27"><Input name="label" defaultValue={v(d, "label")} required /></F>
      <div />
      <F name="starts_on" label="Starts"><Input name="starts_on" type="date" defaultValue={v(d, "starts_on")} required /></F>
      <F name="ends_on" label="Ends"><Input name="ends_on" type="date" defaultValue={v(d, "ends_on")} required /></F>
      <Checkbox name="is_current" defaultChecked={Boolean(d?.is_current)} label="Current academic year" />
      <Actions id={id} kind="year" />
    </ActionForm>
  );
}

export function TermForm({ d, id, years }: { d?: D; id?: string; years: Opt[] }) {
  return (
    <ActionForm action={saveEntity.bind(null, "term", id ?? null)} resetOnSuccess={!id} className="grid gap-4 sm:grid-cols-2">
      <F name="name" label="Name" required hint="e.g. Odd Semester 2026-27"><Input name="name" defaultValue={v(d, "name")} required /></F>
      <F name="academic_year_id" label="Academic year" required><Select name="academic_year_id" defaultValue={v(d, "academic_year_id")} required><option value="" disabled>Choose</option>{years.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}</Select></F>
      <F name="term_type" label="Term"><Select name="term_type" defaultValue={v(d, "term_type", "odd")}><option value="odd">Odd semester</option><option value="even">Even semester</option></Select></F>
      <div />
      <F name="starts_on" label="Starts"><Input name="starts_on" type="date" defaultValue={v(d, "starts_on")} required /></F>
      <F name="ends_on" label="Ends"><Input name="ends_on" type="date" defaultValue={v(d, "ends_on")} required /></F>
      <Checkbox name="is_current" defaultChecked={Boolean(d?.is_current)} label="Current term (drives timetables and dashboards)" />
      <Actions id={id} kind="term" />
    </ActionForm>
  );
}

export function BatchForm({ d, id, programmes }: { d?: D; id?: string; programmes: Opt[] }) {
  return (
    <ActionForm action={saveEntity.bind(null, "batch", id ?? null)} resetOnSuccess={!id} className="grid gap-4 sm:grid-cols-2">
      <F name="name" label="Name" required hint="e.g. BA Arabic 2026–29"><Input name="name" defaultValue={v(d, "name")} required /></F>
      <F name="programme_id" label="Programme" required><Select name="programme_id" defaultValue={v(d, "programme_id")} required><option value="" disabled>Choose</option>{programmes.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></F>
      <F name="start_year" label="Start year"><Input name="start_year" type="number" defaultValue={v(d, "start_year", new Date().getFullYear())} /></F>
      <F name="current_semester" label="Current semester"><Input name="current_semester" type="number" min={1} max={12} defaultValue={v(d, "current_semester", 1)} /></F>
      <Checkbox name="is_active" defaultChecked={d ? Boolean(d.is_active) : true} label="Active" />
      <Actions id={id} kind="batch" />
    </ActionForm>
  );
}

export function ExamForm({ d, id, terms }: { d?: D; id?: string; terms: Opt[] }) {
  return (
    <ActionForm action={saveEntity.bind(null, "exam", id ?? null)} resetOnSuccess={!id} className="grid gap-4 sm:grid-cols-2">
      <F name="name" label="Name" required hint="e.g. First Internal Assessment"><Input name="name" defaultValue={v(d, "name")} required /></F>
      <F name="term_id" label="Term" required><Select name="term_id" defaultValue={v(d, "term_id")} required><option value="" disabled>Choose</option>{terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></F>
      <F name="exam_type" label="Type"><Select name="exam_type" defaultValue={v(d, "exam_type", "internal")}>{["internal", "model", "semester", "supplementary"].map((t) => <option key={t}>{t}</option>)}</Select></F>
      <div className="grid grid-cols-2 gap-4">
        <F name="max_marks" label="Max marks"><Input name="max_marks" type="number" defaultValue={v(d, "max_marks", 100)} /></F>
        <F name="pass_percent" label="Pass %"><Input name="pass_percent" type="number" defaultValue={v(d, "pass_percent", 40)} /></F>
      </div>
      <F name="starts_on" label="Starts"><Input name="starts_on" type="date" defaultValue={v(d, "starts_on")} /></F>
      <F name="ends_on" label="Ends"><Input name="ends_on" type="date" defaultValue={v(d, "ends_on")} /></F>
      <Actions id={id} kind="exam" />
    </ActionForm>
  );
}
