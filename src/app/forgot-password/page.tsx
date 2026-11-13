import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotForm } from "./form";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Reset your password" description="Enter your registered email and we will send you a secure reset link.">
      <ForgotForm />
      <p className="mt-6 text-center text-sm"><Link href="/login" className="font-medium text-royal hover:underline">Back to sign in</Link></p>
    </AuthShell>
  );
}
