import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Notice } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { MfaManager } from "./mfa-manager";

export const metadata = { title: "Security" };

export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ required?: string }> }) {
  await requireUser();
  const { required } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  const verified = (data?.totp ?? []).filter((f) => f.status === "verified");
  return (
    <>
      <PageHeader title="Security" description="Two-step verification with an authenticator app (TOTP)." back={{ href: "/portal/account", label: "Account settings" }} />
      {required && <Notice tone="warning" className="mb-6" title="Two-step verification required">The school requires two-step verification for your role. Set it up below to continue to your portal.</Notice>}
      <Card className="max-w-2xl">
        <CardHeader title="Authenticator app" description={verified.length ? "Two-step verification is on." : "Two-step verification is off."} />
        <CardBody>
          {verified.length > 0 && (
            <ul className="mb-5 divide-y divide-line rounded-sm border border-line">
              {verified.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span><span className="font-medium">{f.friendly_name ?? "Authenticator"}</span><span className="block text-xs text-muted">Added {formatDateTime(f.created_at)}</span></span>
                  <MfaManager mode="remove" factorId={f.id} />
                </li>
              ))}
            </ul>
          )}
          {verified.length === 0 && <MfaManager mode="enrol" />}
        </CardBody>
      </Card>
    </>
  );
}
