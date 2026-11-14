"use client";
import { useTransition } from "react";
import { X } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { F } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/form";
import { DAY_NAMES } from "@/lib/format";
import { addScheduleSlot, removeScheduleSlot } from "../academic-actions";

export function AddPeriodForm({ offerings }: { offerings: { value: string; label: string }[] }) {
  return (
    <ActionForm action={addScheduleSlot} className="space-y-3">
      <F name="offering_id" label="Subject"><Select name="offering_id">{offerings.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></F>
      <F name="day_of_week" label="Day"><Select name="day_of_week">{[1, 2, 3, 4, 5, 6].map((d) => <option key={d} value={d}>{DAY_NAMES[d]}</option>)}</Select></F>
      <div className="grid grid-cols-2 gap-3">
        <F name="starts_at" label="Starts"><Input name="starts_at" type="time" defaultValue="09:30" required /></F>
        <F name="ends_at" label="Ends"><Input name="ends_at" type="time" defaultValue="10:15" required /></F>
      </div>
      <F name="room" label="Room"><Input name="room" /></F>
      <SubmitButton variant="dark">Add period</SubmitButton>
    </ActionForm>
  );
}

export function RemovePeriod({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} aria-label="Remove period" onClick={() => { if (confirm("Remove this period?")) start(() => removeScheduleSlot(id)); }}
      className="absolute right-1 top-1 rounded-xs p-0.5 text-muted hover:bg-white hover:text-danger"><X className="h-3.5 w-3.5" /></button>
  );
}
