"use client";
import { buttonClass } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[60dvh] items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="font-display text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-muted">The page could not be loaded. Please try again; if the problem continues, contact the college office.</p>
        <button onClick={reset} className={buttonClass("dark", "md", "mt-8")}>Try again</button>
      </div>
    </main>
  );
}
