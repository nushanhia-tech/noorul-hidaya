"use client";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { F } from "@/components/ui/field";
import { Input } from "@/components/ui/form";
import { completePasswordReset } from "../login/actions";

export function ResetForm() {
  return (
    <ActionForm action={completePasswordReset} className="space-y-5">
      <F name="password" label="New password" required><Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} /></F>
      <F name="confirm" label="Confirm new password" required><Input id="confirm" name="confirm" type="password" autoComplete="new-password" required /></F>
      <SubmitButton variant="royal" size="lg" className="w-full">Update password</SubmitButton>
    </ActionForm>
  );
}
