"use client";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { F } from "@/components/ui/field";
import { Input } from "@/components/ui/form";
import { verifyMfa } from "../actions";

export function MfaForm({ next }: { next: string }) {
  return (
    <ActionForm action={verifyMfa} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      <F name="code" label="Verification code" required>
        <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus className="tabular text-center text-xl tracking-[0.4em]" />
      </F>
      <SubmitButton variant="royal" size="lg" className="w-full" pendingLabel="Verifying…">Verify</SubmitButton>
    </ActionForm>
  );
}
