"use client";

import { useState, useTransition } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { F } from "@/components/ui/field";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/form";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import type { Role } from "@/lib/auth/roles";
import { humanize } from "@/lib/format";
import { linkParent, saveFacultyRecord, saveStudentRecord, setLinkStatus, setRoles, setUserPassword, updateAccount } from "../actions";
import { FacultyFields, RoleCheckboxes, SectionFields, StudentFields, type Lookups } from "../role-fields";

type Props = {
  profile: { id: string; full_name: string; email: string | null; phone: string | null; is_active: boolean };
  roles: Role[]; student: Record<string, unknown> | null; faculty: Record<string, unknown> | null; lk: Lookups;
  sections: string[]; canRoles: boolean; isSelf: boolean;
  links: { id: string; relationship: string; status: string; consent: boolean; name: string; register_no: string }[];
};

export function UserDetail({ profile, roles, student, faculty, lk, sections, canRoles, isSelf, links }: Props) {
  const [selRoles, setSelRoles] = useState<Role[]>(roles);
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <Card>
          <CardHeader title="Account" />
          <CardBody>
            <ActionForm action={updateAccount.bind(null, profile.id)} className="space-y-4">
              <F name="full_name" label="Full name" required><Input id="full_name" name="full_name" defaultValue={profile.full_name} required /></F>
              <F name="phone" label="Phone"><Input id="phone" name="phone" defaultValue={profile.phone ?? ""} /></F>
              <Checkbox name="is_active" defaultChecked={profile.is_active} disabled={isSelf} label="Account active (deactivating blocks sign-in immediately)" />
              <SubmitButton variant="dark">Save account</SubmitButton>
            </ActionForm>
          </CardBody>
          <CardBody className="border-t border-line">
            <p className="text-sm font-medium">Set a new password</p>
            <p className="mt-1 text-[13px] text-muted">Use this when a user forgets their password. No email is sent — give the new password to the user directly.</p>
            <ActionForm action={setUserPassword.bind(null, profile.id)} resetOnSuccess className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
              <Input name="password" type="text" autoComplete="new-password" aria-label="New password" placeholder="New password" required className="sm:max-w-xs" />
              <SubmitButton variant="outline">Set password</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Roles & sections" description={canRoles ? undefined : "You need the roles.manage permission to change roles."} />
          <CardBody>
            <ActionForm action={setRoles.bind(null, profile.id)} className="space-y-5">
              <RoleCheckboxes selected={selRoles} onChange={setSelRoles} disabled={!canRoles} />
              <SectionFields lk={lk} selected={sections} roles={selRoles} />
              {canRoles && <SubmitButton variant="dark">Save roles</SubmitButton>}
            </ActionForm>
          </CardBody>
        </Card>
      </div>
      <div className="space-y-6">
        {(selRoles.includes("student") || student) && (
          <Card>
            <CardHeader title="Student record" description="Official academic identifiers. Students cannot edit these." />
            <CardBody><ActionForm action={saveStudentRecord.bind(null, profile.id)} className="space-y-4"><StudentFields lk={lk} d={student ?? undefined} /><SubmitButton variant="dark">Save student record</SubmitButton></ActionForm></CardBody>
          </Card>
        )}
        {(selRoles.includes("faculty") || faculty) && (
          <Card>
            <CardHeader title="Faculty record" />
            <CardBody><ActionForm action={saveFacultyRecord.bind(null, profile.id)} className="space-y-4"><FacultyFields lk={lk} d={faculty ?? undefined} /><SubmitButton variant="dark">Save faculty record</SubmitButton></ActionForm></CardBody>
          </Card>
        )}
        {selRoles.includes("parent") && (
          <Card>
            <CardHeader title="Linked students" description="Parents see a student's information only through an active, verified link." />
            {links.length > 0 && (
              <ul className="divide-y divide-line border-b border-line">
                {links.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <span><span className="text-sm font-medium">{l.name}</span><span className="block text-xs text-muted">{l.register_no} · {humanize(l.relationship)}</span></span>
                    <span className="flex items-center gap-2">
                      <StatusBadge status={l.status} />
                      {l.status !== "active" && <Button size="sm" variant="outline" disabled={pending} onClick={() => start(() => setLinkStatus(l.id, profile.id, "active"))}>Verify</Button>}
                      {l.status !== "revoked" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(() => setLinkStatus(l.id, profile.id, "revoked"))}>Revoke</Button>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <CardBody>
              <ActionForm action={linkParent.bind(null, profile.id)} resetOnSuccess className="grid gap-4 sm:grid-cols-2">
                <F name="register_no" label="Student register number" required><Input id="register_no" name="register_no" required /></F>
                <F name="relationship" label="Relationship"><Select id="relationship" name="relationship">{["mother", "father", "guardian", "other"].map((r) => <option key={r} value={r}>{humanize(r)}</option>)}</Select></F>
                <F name="notes" label="Verification notes" className="sm:col-span-2" hint="e.g. documents checked"><Textarea id="notes" name="notes" rows={2} /></F>
                <Checkbox className="sm:col-span-2" name="consent" label="Relationship verified and, for adult students, the student's consent has been recorded" />
                <div className="sm:col-span-2"><SubmitButton variant="dark">Link student</SubmitButton></div>
              </ActionForm>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
