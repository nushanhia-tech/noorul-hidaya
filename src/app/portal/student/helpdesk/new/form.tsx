"use client";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { F } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/form";
import { TICKET_CATEGORIES } from "@/lib/constants";
import { createTicket } from "../actions";

export function NewTicketForm() {
  return (
    <ActionForm action={createTicket} className="space-y-4">
      <F name="category" label="Category" required>
        <Select id="category" name="category" required defaultValue="">
          <option value="" disabled>Choose a category</option>
          {Object.entries(TICKET_CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      </F>
      <F name="subject" label="Subject" required><Input id="subject" name="subject" maxLength={160} required placeholder="e.g. Bonafide certificate for scholarship" /></F>
      <F name="description" label="Description" required hint="Include any details the office needs, such as purpose, dates or receipt numbers.">
        <Textarea id="description" name="description" rows={6} required />
      </F>
      <F name="files" label="Attachments" hint="Optional. Up to 5 files — PDF, DOCX, PNG, JPG or WEBP, 10 MB each.">
        <input id="files" name="files" type="file" multiple accept=".pdf,.docx,image/png,image/jpeg,image/webp" className="block w-full text-sm file:mr-3 file:rounded-xs file:border-0 file:bg-sand file:px-3 file:py-1.5 file:text-sm" />
      </F>
      <SubmitButton pendingLabel="Submitting…">Submit request</SubmitButton>
    </ActionForm>
  );
}
