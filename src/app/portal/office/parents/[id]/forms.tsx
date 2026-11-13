"use client";
import { useTransition } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { replyToParent, setThreadStatus } from "../actions";

export function OfficeParentReply({ id }: { id: string }) {
  return (
    <ActionForm action={replyToParent.bind(null, id)} resetOnSuccess className="space-y-3">
      <label htmlFor="body" className="sr-only">Reply</label>
      <Textarea id="body" name="body" rows={4} required placeholder="Official reply to the parent…" />
      <SubmitButton variant="dark">Send reply</SubmitButton>
    </ActionForm>
  );
}

export function ThreadToggle({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  return <Button variant="outline" disabled={pending} onClick={() => start(() => setThreadStatus(id, status === "open" ? "closed" : "open"))}>{status === "open" ? "Close conversation" : "Reopen"}</Button>;
}
