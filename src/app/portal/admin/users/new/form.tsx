"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { F } from "@/components/ui/field";
import { Input } from "@/components/ui/form";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import type { Role } from "@/lib/auth/roles";
import { createUser } from "../actions";
import { RoleCheckboxes, StudentFields, FacultyFields, SectionFields, type Lookups } from "../role-fields";

export function NewUserForm({ lk }: { lk: Lookups }) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [method, setMethod] = useState<"invite" | "password">("invite");
  return (
    <ActionForm action={createUser} className="grid max-w-4xl gap-6">
      <Card>
        <CardHeader title="Account" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <F name="full_name" label="Full name" required><Input id="full_name" name="full_name" required /></F>
          <F name="email" label="Email" required><Input id="email" name="email" type="email" required /></F>
          <F name="phone" label="Phone"><Input id="phone" name="phone" type="tel" /></F>
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-[13px] font-medium text-ink-soft">How will the user set their password?</legend>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-6 text-sm">
              <label className="flex items-center gap-2"><input type="radio" name="method" value="invite" checked={method === "invite"} onChange={() => setMethod("invite")} /> Email an invitation link (recommended)</label>
              <label className="flex items-center gap-2"><input type="radio" name="method" value="password" checked={method === "password"} onChange={() => setMethod("password")} /> Set a temporary password</label>
            </div>
          </fieldset>
          {method === "password" && <F name="password" label="Temporary password" hint="At least 10 characters with upper/lower case and a number. Share it securely." className="sm:col-span-2"><Input id="password" name="password" type="password" autoComplete="new-password" required /></F>}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Roles" description="Choose every portal this person needs." />
        <CardBody className="space-y-5"><RoleCheckboxes selected={roles} onChange={setRoles} /><SectionFields lk={lk} selected={[]} roles={roles} /></CardBody>
      </Card>
      {roles.includes("student") && <Card><CardHeader title="Student record" /><CardBody><StudentFields lk={lk} /></CardBody></Card>}
      {roles.includes("faculty") && <Card><CardHeader title="Faculty record" /><CardBody><FacultyFields lk={lk} /></CardBody></Card>}
      {roles.includes("parent") && <p className="text-sm text-muted">After creating a parent account, link it to a student from the user&rsquo;s page.</p>}
      <div><SubmitButton size="lg" pendingLabel="Creating…">Create user</SubmitButton></div>
    </ActionForm>
  );
}
