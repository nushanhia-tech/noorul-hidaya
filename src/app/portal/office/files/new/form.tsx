"use client";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { F } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/form";
import { Card, CardBody } from "@/components/ui/card";
import { FILE_CATEGORIES } from "@/lib/constants";
import { createFile } from "../actions";
import { StudentPicker } from "@/components/portal/student-picker";

type O = { value: string; label: string };

export function NewFileForm({ sections, departments, staff, studentId, studentLabel }: { sections: O[]; departments: O[]; staff: O[]; studentId?: string; studentLabel: string | null }) {
  return (
    <Card className="max-w-3xl">
      <CardBody>
        <ActionForm action={createFile} className="grid gap-4 sm:grid-cols-2">
          <F name="subject" label="Subject" required className="sm:col-span-2"><Input name="subject" required placeholder="e.g. Transfer certificate request — final year" /></F>
          <F name="category" label="Category" required><Select name="category" defaultValue="student_record">{Object.entries(FILE_CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></F>
          <F name="priority" label="Priority"><Select name="priority" defaultValue="normal">{["low", "normal", "high", "urgent"].map((p) => <option key={p}>{p}</option>)}</Select></F>
          <F name="description" label="Description" className="sm:col-span-2"><Textarea name="description" rows={4} /></F>
          <F name="student_id" label="Linked student" className="sm:col-span-2"><StudentPicker name="student_id" defaultId={studentId} defaultLabel={studentLabel} /></F>
          <F name="department_id" label="Department"><Select name="department_id" defaultValue=""><option value="">None</option>{departments.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></F>
          <F name="section_id" label="Office section"><Select name="section_id" defaultValue=""><option value="">None</option>{sections.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></F>
          <F name="assigned_to" label="Assign to"><Select name="assigned_to" defaultValue=""><option value="">Unassigned</option>{staff.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></F>
          <F name="due_date" label="Deadline"><Input name="due_date" type="date" /></F>
          <F name="files" label="Documents" hint="Optional · up to 5 files · PDF, DOCX or images · 10 MB each" className="sm:col-span-2">
            <input name="files" type="file" multiple accept=".pdf,.docx,image/png,image/jpeg,image/webp" className="block w-full text-sm file:mr-3 file:rounded-xs file:border-0 file:bg-sand file:px-3 file:py-1.5" />
          </F>
          <div className="sm:col-span-2"><SubmitButton pendingLabel="Creating…">Create file</SubmitButton></div>
        </ActionForm>
      </CardBody>
    </Card>
  );
}
