import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

export const metadata = { title: "Access denied" };

export default function Forbidden() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="max-w-md text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-accent" />
        <h1 className="mt-5 font-display text-3xl font-semibold">You don&rsquo;t have access to this page</h1>
        <p className="mt-3 text-muted">Your account is not authorised for this portal or record. If you believe this is a mistake, contact the school office.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/select-role" className={buttonClass("dark")}>Go to my portal</Link>
          <Link href="/" className={buttonClass("outline")}>Website</Link>
        </div>
      </div>
    </main>
  );
}
