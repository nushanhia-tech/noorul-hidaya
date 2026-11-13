"use client";
import { useTransition } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { F } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/form";
import { TASK_STATUS_LABELS } from "@/lib/constants";
import { commentOnTask, setTaskStatus, updateTask } from "../actions";

export function QuickStatus({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  return (
    <select aria-label="Task status" defaultValue={status} disabled={pending} onChange={(e) => start(async () => { await setTaskStatus(id, e.target.value); })}
      className="h-10 rounded-sm border border-line-strong bg-white px-3 text-sm font-medium">
      {Object.entries(TASK_STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
    </select>
  );
}

export function EditTaskForm({ t, staff }: { t: { id: string; title: string; instructions: string; priority: string; due_on: string | null; assigned_to: string | null; status: string }; staff: { value: string; label: string }[] }) {
  return (
    <ActionForm action={updateTask.bind(null, t.id)} className="grid gap-3">
      <input type="hidden" name="status" value={t.status} />
      <F name="title" label="Title"><Input name="title" defaultValue={t.title} required /></F>
      <F name="instructions" label="Instructions"><Textarea name="instructions" rows={3} defaultValue={t.instructions} /></F>
      <div className="grid gap-3 sm:grid-cols-2">
        <F name="assigned_to" label="Assigned to"><Select name="assigned_to" defaultValue={t.assigned_to ?? ""}>{staff.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></F>
        <F name="priority" label="Priority"><Select name="priority" defaultValue={t.priority}>{["low", "normal", "high", "urgent"].map((p) => <option key={p}>{p}</option>)}</Select></F>
        <F name="due_on" label="Deadline"><Input name="due_on" type="date" defaultValue={t.due_on ?? ""} /></F>
      </div>
      <div><SubmitButton variant="dark">Save</SubmitButton></div>
    </ActionForm>
  );
}

export function CommentForm({ id }: { id: string }) {
  return (
    <ActionForm action={commentOnTask.bind(null, id)} resetOnSuccess className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <label htmlFor="body" className="sr-only">Comment</label>
      <Textarea id="body" name="body" rows={2} required placeholder="Add a comment…" className="flex-1" />
      <SubmitButton variant="outline">Comment</SubmitButton>
    </ActionForm>
  );
}
