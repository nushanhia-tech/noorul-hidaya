import { AuthShell } from "@/components/auth/auth-shell";
import { Notice } from "@/components/ui/misc";
import { LoginForm } from "./login-form";

export const metadata = { title: "Portal Login" };

const MESSAGES: Record<string, { tone: "success" | "danger" | "info"; text: string }> = {
  signed_out: { tone: "success", text: "You have been signed out." },
  reset: { tone: "success", text: "Your password has been changed. Please sign in." },
  link_expired: { tone: "danger", text: "That link is invalid or has expired. Please request a new one." },
  no_role: { tone: "danger", text: "Your account has no portal access yet. Please contact the college office." },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const key = sp.error ?? (sp.signed_out ? "signed_out" : sp.reset ? "reset" : undefined);
  const msg = key ? MESSAGES[key] : undefined;
  return (
    <AuthShell title="Sign in" description="Use the email address registered with the college.">
      {msg && <Notice tone={msg.tone} className="mb-6">{msg.text}</Notice>}
      <LoginForm next={sp.next} />
    </AuthShell>
  );
}
