"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Send, Unlock } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { F } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/misc";
import { addExamSession, publishResults, returnSheet, setExamStatus } from "../../academic-actions";

export function ExamControls({ examId, status, canPublish, canManage, ready, progress }: { examId: string; status: string; canPublish: boolean; canManage: boolean; ready: boolean; progress: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) => start(async () => {
    const r = await fn();
    setMsg(r.ok ? (r.message ? { ok: true, text: r.message } : null) : { ok: false, text: r.error ?? "Failed" });
    router.refresh();
  });
  return (
    <div className="space-y-3">
      {msg && <Notice tone={msg.ok ? "success" : "danger"}>{msg.text}</Notice>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">{progress}</p>
        <div className="flex flex-wrap gap-2">
          {status === "scheduled" && (canManage || canPublish) && <Button variant="outline" disabled={pending} onClick={() => run(() => setExamStatus(examId, "marks_entry"))}><Unlock className="h-4 w-4" /> Open marks entry</Button>}
          {status === "marks_entry" && (canManage || canPublish) && <Button variant="outline" disabled={pending} onClick={() => run(() => setExamStatus(examId, "closed"))}><Lock className="h-4 w-4" /> Close marks entry</Button>}
          {status === "closed" && (canManage || canPublish) && <Button variant="ghost" disabled={pending} onClick={() => run(() => setExamStatus(examId, "marks_entry"))}>Reopen entry</Button>}
          {canPublish && status !== "published" && (
            <Button disabled={pending || !ready} title={ready ? undefined : "All mark sheets must be submitted first"} onClick={() => {
              if (confirm("Publish results? Students and linked parents will be notified. Published results cannot be edited.")) run(() => publishResults(examId));
            }}><Send className="h-4 w-4" /> Publish results</Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ReturnForm({ examId, sheetId }: { examId: string; sheetId: string }) {
  return (
    <ActionForm action={returnSheet.bind(null, examId, sheetId)} className="space-y-3">
      <F name="note" label="Return for correction" hint="The teacher is notified with this note and can edit again."><Textarea name="note" rows={2} required /></F>
      <SubmitButton variant="outline">Return mark sheet</SubmitButton>
    </ActionForm>
  );
}

export function SessionForm({ examId, offerings }: { examId: string; offerings: { value: string; label: string }[] }) {
  return (
    <ActionForm action={addExamSession.bind(null, examId)} className="grid gap-3 sm:grid-cols-2">
      <F name="offering_id" label="Subject" className="sm:col-span-2"><Select name="offering_id" defaultValue="" required><option value="" disabled>Choose</option>{offerings.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></F>
      <F name="sits_on" label="Date"><Input name="sits_on" type="date" required /></F>
      <F name="venue" label="Venue"><Input name="venue" /></F>
      <F name="starts_at" label="Starts"><Input name="starts_at" type="time" defaultValue="10:00" required /></F>
      <F name="ends_at" label="Ends"><Input name="ends_at" type="time" defaultValue="13:00" required /></F>
      <div className="sm:col-span-2"><SubmitButton variant="dark">Save session</SubmitButton></div>
    </ActionForm>
  );
}
