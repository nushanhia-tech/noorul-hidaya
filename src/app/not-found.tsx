import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-[70dvh] items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="tabular font-display text-6xl font-semibold text-accent">404</p>
        <h1 className="mt-4 font-display text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-muted">The page you are looking for may have moved or no longer exists.</p>
        <Link href="/" className={buttonClass("dark", "md", "mt-8")}>Return home</Link>
      </div>
    </main>
  );
}
