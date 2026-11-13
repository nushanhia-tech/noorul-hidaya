"use client";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { F } from "@/components/ui/field";
import { Checkbox, Input, Textarea } from "@/components/ui/form";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import type { SiteSettings } from "@/lib/data/site";
import { mediaUrl } from "@/lib/media";
import { saveSettings } from "./actions";

const SECTIONS: [string, string][] = [["intro", "Introduction / about"], ["departments", "Departments"], ["programmes", "Programmes"], ["achievements", "Achievements"], ["announcements", "Announcements"], ["news", "Latest news"], ["events", "Upcoming events"], ["gallery", "Gallery"], ["calendar", "Calendar highlights"], ["faculty", "Faculty highlights"], ["contact", "Contact"]];

export function SettingsForm({ s }: { s: SiteSettings }) {
  const logo = mediaUrl(s.logo_path);
  return (
    <ActionForm action={saveSettings} className="grid max-w-4xl gap-6">
      <Card>
        <CardHeader title="College identity" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <F name="college_name" label="College name" required className="sm:col-span-2"><Input name="college_name" defaultValue={s.college_name} required /></F>
          <F name="short_name" label="Short name" required><Input name="short_name" defaultValue={s.short_name} required /></F>
          <F name="established_year" label="Established"><Input name="established_year" type="number" defaultValue={s.established_year ?? ""} /></F>
          <F name="motto" label="Motto" className="sm:col-span-2"><Input name="motto" defaultValue={s.motto} /></F>
          <F name="intro" label="Short introduction (hero)" className="sm:col-span-2"><Textarea name="intro" rows={2} defaultValue={s.intro} /></F>
          <F name="affiliation" label="Affiliation / accreditation" className="sm:col-span-2"><Input name="affiliation" defaultValue={s.affiliation ?? ""} /></F>
          <div className="sm:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-end">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo && <img src={logo} alt="Current logo" className="h-14 w-auto rounded-xs border border-line bg-white p-1" />}
            <F name="logo" label="Logo" hint="PNG, JPG or WEBP · max 5 MB" className="flex-1"><Input name="logo" type="file" accept="image/png,image/jpeg,image/webp" /></F>
            {logo && <Checkbox name="remove_logo" label="Use default emblem" />}
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Contact information" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <F name="email" label="Email"><Input name="email" type="email" defaultValue={s.email ?? ""} /></F>
          <F name="phone" label="Phone"><Input name="phone" defaultValue={s.phone ?? ""} /></F>
          <F name="address" label="Address" className="sm:col-span-2"><Input name="address" defaultValue={s.address ?? ""} /></F>
          <F name="map_url" label="Map link" className="sm:col-span-2"><Input name="map_url" type="url" defaultValue={s.map_url ?? ""} /></F>
          <F name="footer_text" label="Footer text" className="sm:col-span-2"><Textarea name="footer_text" rows={2} defaultValue={s.footer_text ?? ""} /></F>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Homepage sections" description="Untick a section to hide it. Sections only appear when they have published content." />
        <CardBody className="grid gap-2 sm:grid-cols-3">
          {SECTIONS.map(([k, l]) => <Checkbox key={k} name="home_sections" value={k} label={l} defaultChecked={s.home_sections.includes(k)} />)}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Academic, notifications & security" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <F name="currency" label="Currency (ISO code)"><Input name="currency" defaultValue={s.currency} maxLength={3} /></F>
          <div />
          <Checkbox name="email_notifications" defaultChecked={s.email_notifications} label="Send notification emails (requires RESEND_API_KEY)" />
          <Checkbox name="require_mfa_privileged" defaultChecked={s.require_mfa_privileged} label="Require two-step verification for administrators, accountants and office supervisors" />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Backups" description="Supabase takes daily database backups on paid plans. Record your backup and restore arrangements here (see docs/BACKUP_AND_RESTORE.md)." />
        <CardBody><F name="backup_notes" label="Backup status & notes"><Textarea name="backup_notes" rows={4} defaultValue={s.backup_notes ?? ""} placeholder="e.g. Daily PITR enabled on Pro plan; weekly pg_dump to offsite storage verified on…" /></F></CardBody>
      </Card>
      <div><SubmitButton size="lg">Save settings</SubmitButton></div>
      <Card className="border-danger/30">
        <CardHeader title="Danger zone" description="Delete all data and start again with an empty system." />
        <CardBody><a href="/portal/admin/settings/reset" className="inline-flex h-10 items-center rounded-sm bg-danger px-4 text-sm font-medium text-white hover:bg-danger/90">Full site reset…</a></CardBody>
      </Card>
    </ActionForm>
  );
}
