"use client";

import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { F } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/form";
import { sendContactMessage } from "./actions";

export function ContactForm() {
  return (
    <ActionForm action={sendContactMessage} resetOnSuccess className="mt-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <F name="name" label="Full name" required><Input id="name" name="name" required autoComplete="name" /></F>
        <F name="email" label="Email" required><Input id="email" name="email" type="email" required autoComplete="email" /></F>
        <F name="phone" label="Phone"><Input id="phone" name="phone" type="tel" autoComplete="tel" /></F>
        <F name="subject" label="Subject" required><Input id="subject" name="subject" required /></F>
      </div>
      <F name="message" label="Message" required><Textarea id="message" name="message" rows={6} required /></F>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <SubmitButton variant="dark" size="lg" pendingLabel="Sending…">Send message</SubmitButton>
    </ActionForm>
  );
}
