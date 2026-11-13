"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { Notice } from "@/components/ui/misc";
import { buttonClass } from "@/components/ui/button";
import { isSafeNext } from "@/lib/auth/roles";

/**
 * Finishes invitation / password-reset links that carry their result in the
 * URL fragment: either a session (#access_token=…) or an error (#error=…).
 */
export function CompleteLink() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void finish();
    async function finish() {
    await Promise.resolve(); // run after mount: the fragment only exists in the browser
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const errCode = hash.get("error_code") ?? hash.get("error");
    if (errCode) {
      setError(errCode === "otp_expired"
        ? "This link has expired or has already been used. Email links work only once and only for a limited time."
        : (hash.get("error_description") ?? "This link could not be used.").replace(/\+/g, " "));
      return;
    }
    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");
    const type = hash.get("type");
    if (!access_token || !refresh_token) {
      setError("This link is incomplete. Please open it again from the email, or request a new one.");
      return;
    }
    const { error: e } = await createClient().auth.setSession({ access_token, refresh_token });
    if (e) return setError("This link has expired. Please request a new one.");
    window.history.replaceState(null, "", window.location.pathname);
    const next = params.get("next") ?? "/select-role";
    router.replace(type === "invite" || type === "recovery" || type === "signup" ? "/reset-password" : isSafeNext(next) ? next : "/select-role");
    router.refresh();
    }
  }, [params, router]);

  if (!error) {
    return <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Signing you in…</p>;
  }
  return (
    <div className="space-y-5">
      <Notice tone="danger" title="Link not valid">{error}</Notice>
      <p className="text-sm text-muted">
        <strong className="text-ink">Invited as a new user?</strong> Ask the college office to resend your invitation.<br />
        <strong className="text-ink">Already have an account?</strong> Request a fresh password-reset link below.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href="/forgot-password" className={buttonClass("royal")}>Send a new reset link</Link>
        <Link href="/login" className={buttonClass("outline")}>Back to sign in</Link>
      </div>
    </div>
  );
}
