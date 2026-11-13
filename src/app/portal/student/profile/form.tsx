"use client";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { F } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/form";
import { updateStudentProfile } from "./actions";

export function ProfileForm(p: { phone: string; address: string; guardianPhone: string; emergency: string }) {
  return (
    <ActionForm action={updateStudentProfile} className="space-y-4">
      <F name="phone" label="Mobile number"><Input id="phone" name="phone" type="tel" defaultValue={p.phone} /></F>
      <F name="address" label="Address"><Textarea id="address" name="address" rows={3} defaultValue={p.address} /></F>
      <F name="guardian_phone" label="Guardian's phone"><Input id="guardian_phone" name="guardian_phone" type="tel" defaultValue={p.guardianPhone} /></F>
      <F name="emergency_contact" label="Emergency contact" hint="Name and number"><Input id="emergency_contact" name="emergency_contact" defaultValue={p.emergency} /></F>
      <SubmitButton variant="dark">Save changes</SubmitButton>
    </ActionForm>
  );
}
