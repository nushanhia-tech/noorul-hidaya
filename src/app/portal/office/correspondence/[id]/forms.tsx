"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { F } from "@/components/ui/field";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { LETTER_MODES } from "@/lib/constants";
import { addLetterDocuments, archiveLetter, updateLetter } from "../actions";

type L = { id: string; direction: string; status: string; mode: string | null; tracking_no: string | null; dispatched_on: string | null; file_id: string | null; body: string | null; acknowledged_at: string | null; acknowledgement_note: string | null };

export function LetterProcessForm({ l, files }: { l: L; files: { value: string; label: string }[] }) {
  const inward = l.direction === "inward";
  return (
    <ActionForm action={updateLetter.bind(null, l.id)} className="grid gap-3 sm:grid-cols-2">
      <F name="status" label="Status"><Select name="status" defaultValue={l.status}>{(inward ? ["received", "under_action", "closed"] : ["draft", "ready", "dispatched", "delivered", "returned"]).map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</Select></F>
      <F name="mode" label="Mode"><Select name="mode" defaultValue={l.mode ?? ""}><option value="">—</option>{Object.entries(LETTER_MODES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></F>
      {!inward && <>
        <F name="dispatched_on" label="Dispatched on"><Input name="dispatched_on" type="date" defaultValue={l.dispatched_on ?? ""} /></F>
        <F name="tracking_no" label="Tracking / consignment no."><Input name="tracking_no" defaultValue={l.tracking_no ?? ""} /></F>
        <F name="body" label="Letter text" className="sm:col-span-2"><Textarea name="body" rows={8} defaultValue={l.body ?? ""} /></F>
      </>}
      <F name="file_id" label="Linked office file" className="sm:col-span-2"><Select name="file_id" defaultValue={l.file_id ?? ""}><option value="">None</option>{files.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></F>
      <Checkbox name="acknowledged" defaultChecked={Boolean(l.acknowledged_at)} className="sm:col-span-2" label={inward ? "Acknowledgement sent to sender" : "Acknowledgement received from recipient"} />
      <F name="acknowledgement_note" label="Acknowledgement note" className="sm:col-span-2"><Input name="acknowledgement_note" defaultValue={l.acknowledgement_note ?? ""} /></F>
      <div className="sm:col-span-2"><SubmitButton variant="dark">Save</SubmitButton></div>
    </ActionForm>
  );
}

export function LetterDocsForm({ id }: { id: string }) {
  return (
    <ActionForm action={addLetterDocuments.bind(null, id)} resetOnSuccess className="space-y-3 border-t border-line pt-4">
      <input name="files" type="file" multiple aria-label="Attach files" accept=".pdf,.docx,image/png,image/jpeg,image/webp" className="block w-full text-sm file:mr-3 file:rounded-xs file:border-0 file:bg-sand file:px-3 file:py-1.5" />
      <SubmitButton variant="outline">Attach</SubmitButton>
    </ActionForm>
  );
}

export function ArchiveLetterButton({ id, archived }: { id: string; archived: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <Button variant="outline" size="sm" disabled={pending} onClick={() => start(async () => { await archiveLetter(id, !archived); router.refresh(); })}>{archived ? "Restore" : "Archive"}</Button>;
}
