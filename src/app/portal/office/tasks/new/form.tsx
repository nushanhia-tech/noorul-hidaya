"use client";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { F } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/form";
import { createTask } from "../actions";

export function NewTaskForm({ staff, me, file, ticket }: { staff: { value: string; label: string }[]; me: string; file: { id: string; label: string } | null; ticket: { id: string; label: string } | null }) {
  return (
    <ActionForm action={createTask} className="grid gap-4 sm:grid-cols-2">
      <F name="title" label="Title" required className="sm:col-span-2"><Input name="title" required /></F>
      <F name="instructions" label="Instructions" className="sm:col-span-2"><Textarea name="instructions" rows={5} /></F>
      <F name="assigned_to" label="Assign to"><Select name="assigned_to" defaultValue={me}>{staff.map((o) => <option key={o.value} value={o.value}>{o.label}{o.value === me ? " (me)" : ""}</option>)}</Select></F>
      <F name="priority" label="Priority"><Select name="priority" defaultValue="normal">{["low", "normal", "high", "urgent"].map((p) => <option key={p}>{p}</option>)}</Select></F>
      <F name="due_on" label="Deadline"><Input name="due_on" type="date" /></F>
      <div />
      {file && <p className="text-sm text-muted sm:col-span-2">Linked file: {file.label}<input type="hidden" name="file_id" value={file.id} /></p>}
      {ticket && <p className="text-sm text-muted sm:col-span-2">Linked request: {ticket.label}<input type="hidden" name="ticket_id" value={ticket.id} /></p>}
      <F name="files" label="Attachments" className="sm:col-span-2"><input name="files" type="file" multiple accept=".pdf,.docx,image/png,image/jpeg,image/webp" className="block w-full text-sm file:mr-3 file:rounded-xs file:border-0 file:bg-sand file:px-3 file:py-1.5" /></F>
      <div className="sm:col-span-2"><SubmitButton>Create task</SubmitButton></div>
    </ActionForm>
  );
}
