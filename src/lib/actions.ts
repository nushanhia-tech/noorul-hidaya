import { ZodError } from "zod";
import { AuthError } from "@/lib/auth/session";

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T; redirectTo?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export const initialState: ActionResult = { ok: true };

/** Map database / validation errors to messages that are safe to show. */
export function toActionError(err: unknown): ActionResult<never> {
  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    const label = (k: string) => k.replace(/_id$/, "").replace(/_/g, " ");
    const details = Object.entries(fieldErrors).slice(0, 4).map(([k, m]) => `${label(k) || "form"}: ${m}`).join(" · ");
    return { ok: false, error: `Please correct the highlighted fields — ${details}`, fieldErrors };
  }
  if (err instanceof AuthError) return { ok: false, error: err.message };
  const e = err as { code?: string; message?: string };
  if (e?.code === "42501") return { ok: false, error: "You do not have permission to do that." };
  if (e?.code === "23505") return { ok: false, error: "A record with these details already exists." };
  if (e?.code === "23503") return { ok: false, error: "This record is linked to other records and cannot be changed that way." };
  if (e?.code === "P0001" || e?.code === "23514" || e?.code === "22003") return { ok: false, error: e.message ?? "Request rejected." };
  if (e?.message?.includes("row-level security")) return { ok: false, error: "You do not have permission to do that." };
  console.error("[action]", err);
  return { ok: false, error: "Something went wrong. Please try again." };
}

/** Throw on a Supabase error so callers can use try/catch uniformly. */
export function must<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data;
}
