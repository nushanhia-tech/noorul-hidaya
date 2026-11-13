"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { F } from "@/components/ui/field";
import { Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { TICKET_STATUS_LABELS } from "@/lib/constants";
import { escalateTicket, staffReply, takeTicket, updateTicket } from "../actions";

type O = { value: string; label: string };

export function TicketControls({ id, t, staff }: { id: string; t: { status: string; priority: string; assigned_to: string | null }; staff: O[] }) {
  return (
    <ActionForm action={updateTicket.bind(null, id)} className="grid gap-3">
      <F name="status" label="Status"><Select name="status" defaultValue={t.status}>{Object.entries(TICKET_STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></F>
      <F name="priority" label="Priority"><Select name="priority" defaultValue={t.priority}>{["low", "normal", "high", "urgent"].map((p) => <option key={p}>{p}</option>)}</Select></F>
      <F name="assigned_to" label="Assigned to"><Select name="assigned_to" defaultValue={t.assigned_to ?? ""}><option value="">Unassigned</option>{staff.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></F>
      <div><SubmitButton variant="dark">Update ticket</SubmitButton></div>
    </ActionForm>
  );
}

export function StaffReplyForm({ id }: { id: string }) {
  return (
    <ActionForm action={staffReply.bind(null, id)} resetOnSuccess className="space-y-3">
      <label htmlFor="body" className="sr-only">Message</label>
      <Textarea id="body" name="body" rows={4} required placeholder="Write to the student, or add an internal note…" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input name="files" type="file" multiple aria-label="Attach files" accept=".pdf,.docx,image/png,image/jpeg,image/webp" className="text-sm file:mr-3 file:rounded-xs file:border-0 file:bg-sand file:px-3 file:py-1.5" />
        <div className="flex flex-wrap gap-2">
          <SubmitButton variant="ghost" name="kind" value="internal">Internal note</SubmitButton>
          <SubmitButton variant="outline" name="kind" value="request_info">Ask for information</SubmitButton>
          <SubmitButton variant="dark" name="kind" value="reply">Send reply</SubmitButton>
        </div>
      </div>
    </ActionForm>
  );
}

export function EscalateForm({ id, supervisors }: { id: string; supervisors: O[] }) {
  return (
    <ActionForm action={escalateTicket.bind(null, id)} className="grid gap-3">
      <F name="escalated_to" label="Supervisor"><Select name="escalated_to" defaultValue="" required><option value="" disabled>Choose</option>{supervisors.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></F>
      <F name="note" label="Reason"><Textarea name="note" rows={2} required /></F>
      <div><SubmitButton variant="outline">Escalate</SubmitButton></div>
    </ActionForm>
  );
}

export function TakeButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <Button variant="primary" size="sm" disabled={pending} onClick={() => start(async () => { await takeTicket(id); router.refresh(); })}>Assign to me</Button>;
}
