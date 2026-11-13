"use client";

import { createContext, use, useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { ActionResult } from "@/lib/actions";
import { Button, type ButtonSize, type ButtonVariant } from "./button";
import { Notice } from "./misc";
import { cn } from "@/lib/utils";

type Action = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

/**
 * Progressive-enhancement form bound to a server action. Shows pending state,
 * field errors (via FieldError) and a truthful success/error message.
 */
export function ActionForm({
  action, children, className, resetOnSuccess = false, successMessage, onSuccessHref,
}: {
  action: Action;
  children: React.ReactNode | ((state: ActionResult) => React.ReactNode);
  className?: string;
  resetOnSuccess?: boolean;
  successMessage?: string;
  onSuccessHref?: string;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(action, { ok: true });
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!submitted) return;
    if (state.ok) {
      if (resetOnSuccess) ref.current?.reset();
      const to = state.redirectTo ?? onSuccessHref;
      if (to) router.push(to);
    }
  }, [state, submitted, resetOnSuccess, onSuccessHref, router]);

  return (
    <form
      ref={ref}
      action={(fd) => {
        setSubmitted(true);
        return formAction(fd);
      }}
      className={className}
      noValidate={false}
    >
      {!state.ok && <Notice tone="danger" className="mb-4">{state.error}</Notice>}
      {state.ok && submitted && (state.message || successMessage) && !state.redirectTo && (
        <Notice tone="success" className="mb-4">{state.message ?? successMessage}</Notice>
      )}
      <FieldErrorsContext value={!state.ok ? state.fieldErrors ?? {} : {}}>
        {typeof children === "function" ? children(state) : children}
      </FieldErrorsContext>
    </form>
  );
}

const FieldErrorsCtx = createContext<Record<string, string>>({});
function FieldErrorsContext({ value, children }: { value: Record<string, string>; children: React.ReactNode }) {
  return <FieldErrorsCtx.Provider value={value}>{children}</FieldErrorsCtx.Provider>;
}
export function useFieldError(name: string) {
  return use(FieldErrorsCtx)[name];
}
export function FieldError({ name }: { name: string }) {
  const msg = useFieldError(name);
  return msg ? <p className="mt-1.5 text-[13px] text-danger" role="alert">{msg}</p> : null;
}

export function SubmitButton({
  children, variant = "primary", size = "md", className, pendingLabel, name, value, formNoValidate,
}: { children: React.ReactNode; variant?: ButtonVariant; size?: ButtonSize; className?: string; pendingLabel?: string; name?: string; value?: string; formNoValidate?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending} className={cn(className)} name={name} value={value} formNoValidate={formNoValidate} aria-busy={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending ? pendingLabel ?? "Saving…" : children}
    </Button>
  );
}
