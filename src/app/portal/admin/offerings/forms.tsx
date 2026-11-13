"use client";
import { useState, useTransition } from "react";
import { Trash2, X } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { F } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/misc";
import { DAY_NAMES } from "@/lib/format";
import { addSlot, assignFaculty, createOffering, removeFaculty, removeSlot, syncEnrolments } from "../academic-actions";

type O = { value: string; label: string };

export function NewOfferingForm({ courses, terms, batches, faculty, defaultTerm }: { courses: O[]; terms: O[]; batches: O[]; faculty: O[]; defaultTerm?: string }) {
  return (
    <ActionForm action={createOffering} className="space-y-4">
      <F name="course_id" label="Course" required><Select name="course_id" defaultValue="" required><option value="" disabled>Choose</option>{courses.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></F>
      <F name="term_id" label="Term" required><Select name="term_id" defaultValue={defaultTerm ?? ""} required>{terms.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></F>
      <F name="batch_id" label="Batch" required hint="Active students in the batch are enrolled automatically."><Select name="batch_id" defaultValue="" required><option value="" disabled>Choose</option>{batches.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></F>
      <F name="semester_number" label="Semester"><Input name="semester_number" type="number" min={1} max={12} defaultValue={1} /></F>
      <F name="faculty_id" label="Teacher"><Select name="faculty_id" defaultValue=""><option value="">Assign later</option>{faculty.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></F>
      <SubmitButton>Create offering</SubmitButton>
    </ActionForm>
  );
}

export function FacultyAssign({ offeringId, options, assigned }: { offeringId: string; options: O[]; assigned: O[] }) {
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-2">
        {assigned.map((a) => (
          <li key={a.value} className="inline-flex items-center gap-1.5 rounded-sm border border-line bg-white py-1 pl-2.5 pr-1 text-sm">
            {a.label}<button disabled={pending} onClick={() => start(() => removeFaculty(offeringId, a.value))} className="rounded-xs p-0.5 hover:bg-sand" aria-label={`Remove ${a.label}`}><X className="h-3.5 w-3.5" /></button>
          </li>
        ))}
        {!assigned.length && <li className="text-sm text-muted">No teacher assigned.</li>}
      </ul>
      <ActionForm action={assignFaculty.bind(null, offeringId)} className="flex gap-2">
        <Select name="faculty_id" aria-label="Faculty" defaultValue="" required><option value="" disabled>Add teacher…</option>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
        <SubmitButton variant="dark">Assign</SubmitButton>
      </ActionForm>
    </div>
  );
}

export function SlotForm({ offeringId }: { offeringId: string }) {
  return (
    <ActionForm action={addSlot.bind(null, offeringId)} resetOnSuccess className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:items-end">
      <F name="day_of_week" label="Day"><Select name="day_of_week">{[1, 2, 3, 4, 5, 6].map((d) => <option key={d} value={d}>{DAY_NAMES[d]}</option>)}</Select></F>
      <F name="starts_at" label="Starts"><Input name="starts_at" type="time" required defaultValue="09:30" /></F>
      <F name="ends_at" label="Ends"><Input name="ends_at" type="time" required defaultValue="10:30" /></F>
      <F name="room" label="Room"><Input name="room" placeholder="Room 204" /></F>
      <SubmitButton variant="dark">Add</SubmitButton>
    </ActionForm>
  );
}

export function SlotRemove({ offeringId, slotId }: { offeringId: string; slotId: string }) {
  const [pending, start] = useTransition();
  return <Button variant="ghost" size="icon" disabled={pending} aria-label="Remove class" onClick={() => start(() => removeSlot(offeringId, slotId))}><Trash2 className="h-4 w-4 text-danger" /></Button>;
}

export function SyncButton({ offeringId }: { offeringId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div>
      <Button variant="outline" size="sm" disabled={pending} onClick={() => start(async () => { const r = await syncEnrolments(offeringId); setMsg(r.ok ? r.message ?? "Done" : r.error); })}>Re-sync batch enrolment</Button>
      {msg && <Notice className="mt-2">{msg}</Notice>}
    </div>
  );
}
