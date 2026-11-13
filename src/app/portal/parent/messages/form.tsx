"use client";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { F } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/form";
import { startThread, replyThread } from "./actions";

export function NewThreadForm({ students }: { students: { value: string; label: string }[] }) {
  return (
    <ActionForm action={startThread} className="space-y-4">
      <F name="student_id" label="About"><Select id="student_id" name="student_id">{students.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select></F>
      <F name="subject" label="Subject" required><Input id="subject" name="subject" required /></F>
      <F name="body" label="Message" required><Textarea id="body" name="body" rows={5} required /></F>
      <SubmitButton pendingLabel="Sending…">Send message</SubmitButton>
    </ActionForm>
  );
}

export function ParentReply({ id }: { id: string }) {
  return (
    <ActionForm action={replyThread.bind(null, id)} resetOnSuccess className="space-y-3">
      <label htmlFor="body" className="sr-only">Reply</label>
      <Textarea id="body" name="body" rows={3} required placeholder="Write a reply…" />
      <SubmitButton variant="dark" pendingLabel="Sending…">Send</SubmitButton>
    </ActionForm>
  );
}
