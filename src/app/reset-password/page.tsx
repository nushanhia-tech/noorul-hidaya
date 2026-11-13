import { AuthShell } from "@/components/auth/auth-shell";
import { ResetForm } from "./form";

export const metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Choose a new password" description="Use at least 10 characters with upper and lower case letters and a number.">
      <ResetForm />
    </AuthShell>
  );
}
