import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { CompleteLink } from "./complete";

export const metadata = { title: "Opening your link" };

export default function CompletePage() {
  return (
    <AuthShell title="Opening your link" description="Please wait a moment.">
      <Suspense><CompleteLink /></Suspense>
    </AuthShell>
  );
}
