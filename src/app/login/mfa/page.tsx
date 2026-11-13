export const dynamic = "force-dynamic";
import { AuthShell } from "@/components/auth/auth-shell";
import { MfaForm } from "./form";

export const metadata = { title: "Two-step verification" };

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthShell title="Two-step verification" description="Enter the 6-digit code from your authenticator app.">
      <MfaForm next={next ?? "/select-role"} />
      <form action="/auth/signout" method="post" className="mt-6 text-center">
        <button className="text-sm text-muted hover:text-ink">Cancel and sign out</button>
      </form>
    </AuthShell>
  );
}
