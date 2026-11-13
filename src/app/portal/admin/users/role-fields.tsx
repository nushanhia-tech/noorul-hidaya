"use client";

import { F } from "@/components/ui/field";
import { Checkbox, Input, Select } from "@/components/ui/form";
import { ROLES, ROLE_LABELS, OFFICE_ROLES, type Role } from "@/lib/auth/roles";

type Opt = { id: string; name: string; code?: string };
export type Lookups = { departments: Opt[]; programmes: (Opt & { department_id: string })[]; batches: (Opt & { programme_id: string })[]; sections: Opt[] };

export function RoleCheckboxes({ selected, onChange, disabled }: { selected: Role[]; onChange?: (r: Role[]) => void; disabled?: boolean }) {
  return (
    <fieldset className="grid gap-2 sm:grid-cols-2" disabled={disabled}>
      <legend className="sr-only">Roles</legend>
      {ROLES.map((r) => (
        <Checkbox key={r} name="roles" value={r} label={ROLE_LABELS[r]} defaultChecked={selected.includes(r)}
          onChange={(e) => onChange?.(e.target.checked ? [...selected, r] : selected.filter((x) => x !== r))} />
      ))}
    </fieldset>
  );
}

export function StudentFields({ lk, d }: { lk: Lookups; d?: Record<string, unknown> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <F name="register_no" label="Register number" required><Input id="register_no" name="register_no" defaultValue={d?.register_no as string} required /></F>
      <F name="admission_no" label="Admission number"><Input id="admission_no" name="admission_no" defaultValue={(d?.admission_no as string) ?? ""} /></F>
      <F name="programme_id" label="Programme" required>
        <Select id="programme_id" name="programme_id" defaultValue={(d?.programme_id as string) ?? ""} required>
          <option value="" disabled>Choose</option>{lk.programmes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </F>
      <F name="batch_id" label="Batch">
        <Select id="batch_id" name="batch_id" defaultValue={(d?.batch_id as string) ?? ""}>
          <option value="">None</option>{lk.batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
      </F>
      <F name="current_semester" label="Current semester" required><Input id="current_semester" name="current_semester" type="number" min={1} max={12} defaultValue={(d?.current_semester as number) ?? 1} /></F>
      <F name="status" label="Status">
        <Select id="status" name="status" defaultValue={(d?.status as string) ?? "active"}>{["active", "graduated", "withdrawn", "suspended"].map((s) => <option key={s} value={s}>{s}</option>)}</Select>
      </F>
      <F name="date_of_birth" label="Date of birth"><Input id="date_of_birth" name="date_of_birth" type="date" defaultValue={(d?.date_of_birth as string) ?? ""} /></F>
      <F name="gender" label="Gender">
        <Select id="gender" name="gender" defaultValue={(d?.gender as string) ?? ""}><option value="">—</option>{["female", "male", "other", "undisclosed"].map((g) => <option key={g} value={g}>{g}</option>)}</Select>
      </F>
      <F name="guardian_name" label="Guardian name"><Input id="guardian_name" name="guardian_name" defaultValue={(d?.guardian_name as string) ?? ""} /></F>
      <F name="admitted_on" label="Admitted on"><Input id="admitted_on" name="admitted_on" type="date" defaultValue={(d?.admitted_on as string) ?? ""} /></F>
    </div>
  );
}

export function FacultyFields({ lk, d }: { lk: Lookups; d?: Record<string, unknown> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <F name="employee_no" label="Employee number" required><Input id="employee_no" name="employee_no" defaultValue={d?.employee_no as string} required /></F>
      <F name="department_id" label="Department" required>
        <Select id="department_id" name="department_id" defaultValue={(d?.department_id as string) ?? ""} required>
          <option value="" disabled>Choose</option>{lk.departments.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </Select>
      </F>
      <F name="designation" label="Designation" required><Input id="designation" name="designation" defaultValue={d?.designation as string} placeholder="Assistant Professor" required /></F>
      <F name="joined_on" label="Joined on"><Input id="joined_on" name="joined_on" type="date" defaultValue={(d?.joined_on as string) ?? ""} /></F>
      <Checkbox name="is_hod" defaultChecked={Boolean(d?.is_hod)} label="Head of department" />
      <Checkbox name="is_public" defaultChecked={d ? Boolean(d.is_public) : true} label="Show in public faculty directory" />
    </div>
  );
}

export function SectionFields({ lk, selected, roles }: { lk: Lookups; selected: string[]; roles: Role[] }) {
  if (!roles.some((r) => OFFICE_ROLES.includes(r))) return null;
  return (
    <fieldset>
      <legend className="mb-2 text-[13px] font-medium text-ink-soft">Office sections (record-level access to section files)</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {lk.sections.map((s) => <Checkbox key={s.id} name="sections" value={s.id} defaultChecked={selected.includes(s.id)} label={s.name} />)}
      </div>
    </fieldset>
  );
}
