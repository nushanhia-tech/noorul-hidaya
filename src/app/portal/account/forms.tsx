"use client";

import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { F } from "@/components/ui/field";
import { Checkbox, Input } from "@/components/ui/form";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { changePassword, updateAvatar, updateContact } from "./actions";

export function AccountForms({ phone, emailNotifications }: { phone: string; emailNotifications: boolean }) {
  return (
    <>
      <Card>
        <CardHeader title="Contact & notifications" />
        <CardBody>
          <ActionForm action={updateContact} className="space-y-4">
            <F name="phone" label="Phone number"><Input id="phone" name="phone" type="tel" defaultValue={phone} autoComplete="tel" /></F>
            <Checkbox name="email_notifications" defaultChecked={emailNotifications} label="Also send important notifications to my email (when email is configured by the school)" />
            <SubmitButton variant="dark">Save</SubmitButton>
          </ActionForm>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Profile photo" description="PNG, JPG or WEBP, up to 5 MB." />
        <CardBody>
          <ActionForm action={updateAvatar} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <F name="avatar" label="Photo" className="flex-1"><Input id="avatar" name="avatar" type="file" accept="image/png,image/jpeg,image/webp" required /></F>
            <SubmitButton variant="outline" pendingLabel="Uploading…">Upload</SubmitButton>
          </ActionForm>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Change password" description="At least 10 characters, with upper and lower case letters and a number." />
        <CardBody>
          <ActionForm action={changePassword} resetOnSuccess className="grid gap-4 sm:grid-cols-2">
            <F name="current" label="Current password" className="sm:col-span-2"><Input id="current" name="current" type="password" autoComplete="current-password" required /></F>
            <F name="password" label="New password"><Input id="password" name="password" type="password" autoComplete="new-password" required /></F>
            <F name="confirm" label="Confirm new password"><Input id="confirm" name="confirm" type="password" autoComplete="new-password" required /></F>
            <div className="sm:col-span-2"><SubmitButton variant="dark">Change password</SubmitButton></div>
          </ActionForm>
        </CardBody>
      </Card>
    </>
  );
}
