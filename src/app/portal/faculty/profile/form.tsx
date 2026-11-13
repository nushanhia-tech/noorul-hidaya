"use client";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { F } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/form";
import { updateFacultyProfile } from "./actions";

export function FacultyProfileForm(p: { qualification: string; specialization: string; bio: string }) {
  return (
    <ActionForm action={updateFacultyProfile} className="space-y-4">
      <F name="qualification" label="Qualification"><Input id="qualification" name="qualification" defaultValue={p.qualification} placeholder="e.g. MA, PhD" /></F>
      <F name="specialization" label="Specialisation"><Input id="specialization" name="specialization" defaultValue={p.specialization} /></F>
      <F name="bio" label="Short bio"><Textarea id="bio" name="bio" rows={5} defaultValue={p.bio} /></F>
      <SubmitButton variant="dark">Save</SubmitButton>
    </ActionForm>
  );
}
