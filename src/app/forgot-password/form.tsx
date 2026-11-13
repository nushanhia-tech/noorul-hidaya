"use client";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { F } from "@/components/ui/field";
import { Input } from "@/components/ui/form";
import { requestPasswordReset } from "../login/actions";

export function ForgotForm() {
  return (
    <ActionForm action={requestPasswordReset} resetOnSuccess className="space-y-5">
      <F name="email" label="Email address" required><Input id="email" name="email" type="email" autoComplete="email" required /></F>
      <SubmitButton variant="royal" size="lg" className="w-full" pendingLabel="Sending…">Send reset link</SubmitButton>
    </ActionForm>
  );
}
