"use client";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { F } from "@/components/ui/field";
import { Checkbox, Input, Textarea } from "@/components/ui/form";
import { saveTemplate } from "../actions";

export function TemplateForm({ t }: { t?: { id: string; name: string; subject: string; body: string; is_active: boolean } }) {
  return (
    <ActionForm action={saveTemplate.bind(null, t?.id ?? null)} resetOnSuccess={!t} className="grid gap-3">
      <F name="name" label="Template name" required><Input name="name" defaultValue={t?.name} required /></F>
      <F name="subject" label="Subject" required><Input name="subject" defaultValue={t?.subject} required /></F>
      <F name="body" label="Body" required><Textarea name="body" rows={10} defaultValue={t?.body} required /></F>
      <Checkbox name="is_active" defaultChecked={t ? t.is_active : true} label="Active" />
      <div><SubmitButton variant="dark">Save template</SubmitButton></div>
    </ActionForm>
  );
}
