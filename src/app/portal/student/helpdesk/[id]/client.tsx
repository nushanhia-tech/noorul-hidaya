"use client";
import { useTransition } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { replyToTicket, setOwnTicketStatus } from "../actions";

export function ReplyForm({ id }: { id: string }) {
  return (
    <ActionForm action={replyToTicket.bind(null, id)} resetOnSuccess className="space-y-3">
      <label htmlFor="body" className="sr-only">Reply</label>
      <Textarea id="body" name="body" rows={3} placeholder="Write a reply…" required />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input name="files" type="file" multiple aria-label="Attach files" accept=".pdf,.docx,image/png,image/jpeg,image/webp" className="text-sm file:mr-3 file:rounded-xs file:border-0 file:bg-sand file:px-3 file:py-1.5 file:text-sm" />
        <SubmitButton variant="dark" pendingLabel="Sending…">Send reply</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function StatusButtons({ id, canClose, canReopen }: { id: string; canClose: boolean; canReopen: boolean }) {
  const [pending, start] = useTransition();
  return (
    <>
      {canClose && <Button variant="outline" disabled={pending} onClick={() => start(() => setOwnTicketStatus(id, "closed"))}>Mark as closed</Button>}
      {canReopen && <Button variant="outline" disabled={pending} onClick={() => start(() => setOwnTicketStatus(id, "open"))}>Reopen request</Button>}
    </>
  );
}
