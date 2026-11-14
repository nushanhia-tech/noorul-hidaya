import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Notice } from "@/components/ui/misc";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Forgot your password?" description="Passwords are reset by the college office.">
      <Notice tone="info">Contact the college office or your administrator. They will set a new password for you, which you can change after signing in (Account settings).</Notice>
      <p className="mt-6 text-center text-sm"><Link href="/login" className="font-medium text-royal hover:underline">Back to sign in</Link></p>
    </AuthShell>
  );
}
