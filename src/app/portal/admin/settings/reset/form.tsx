"use client";
import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { F } from "@/components/ui/field";
import { Checkbox, Input } from "@/components/ui/form";
import { fullReset } from "./actions";

export function ResetForm({ email }: { email: string }) {
  const [typed, setTyped] = useState("");
  return (
    <ActionForm action={fullReset} className="space-y-4">
      <F name="confirm" label='Type RESET to confirm' required><Input id="confirm" name="confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" /></F>
      <F name="password" label={`Your password (${email})`} required><Input id="password" name="password" type="password" autoComplete="current-password" required /></F>
      <Checkbox name="reset_settings" label="Also reset school settings (name, logo, contact details) to defaults" />
      <SubmitButton variant="danger" pendingLabel="Resetting… do not close this page">Permanently reset the site</SubmitButton>
      {typed !== "RESET" && <p className="text-xs text-muted">The reset only runs when the confirmation box says exactly RESET.</p>}
    </ActionForm>
  );
}
