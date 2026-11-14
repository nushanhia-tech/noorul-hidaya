import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, KeyValue, Avatar } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { mediaUrl } from "@/lib/media";
import { AccountForms } from "./forms";

export const metadata = { title: "Account settings" };

export default async function AccountPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("full_name, email, phone, notification_prefs").eq("id", user.id).single();
  return (
    <>
      <PageHeader title="Account settings" description="Manage your contact details, password and security." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Account" description="Official details are maintained by the school office." />
            <CardBody className="flex flex-col gap-6 sm:flex-row">
              <Avatar name={user.fullName} src={mediaUrl(user.avatarPath)} size={72} />
              <KeyValue items={[
                { label: "Name", value: profile?.full_name },
                { label: "Email", value: profile?.email },
                { label: "Roles", value: user.roles.map((r) => ROLE_LABELS[r]).join(", ") },
              ]} />
            </CardBody>
          </Card>
          <AccountForms phone={profile?.phone ?? ""} emailNotifications={Boolean((profile?.notification_prefs as { email?: boolean } | null)?.email ?? true)} />
        </div>
        <Card className="h-fit">
          <CardBody>
            <ShieldCheck className="h-6 w-6 text-teal" />
            <h2 className="mt-3 font-semibold">Two-step verification</h2>
            <p className="mt-1 text-sm text-muted">Protect your account with an authenticator app. Recommended for administrators and accounts staff.</p>
            <Link href="/portal/account/security" className="mt-4 inline-block text-sm font-medium text-royal hover:underline">Manage security</Link>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
