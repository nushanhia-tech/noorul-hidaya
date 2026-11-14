"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { Field, Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/misc";
import { signIn } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "", next },
  });

  const onSubmit = handleSubmit((values) => {
    setError(null);
    start(async () => {
      const res = await signIn(values);
      if (!res.ok) setError(res.error);
      else if (res.redirectTo) {
        router.replace(res.redirectTo);
        router.refresh();
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5" aria-describedby={error ? "login-error" : undefined}>
      {error && <div id="login-error"><Notice tone="danger">{error}</Notice></div>}
      <Field label="Email address" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="username" inputMode="email" autoFocus aria-invalid={!!errors.email} {...register("email")} />
      </Field>
      <Field label="Password" htmlFor="password" error={errors.password?.message}>
        <div className="relative">
          <Input id="password" type={show ? "text" : "password"} autoComplete="current-password" className="pr-11" aria-invalid={!!errors.password} {...register("password")} />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xs text-muted hover:text-ink" aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}>
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </Field>
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm font-medium text-royal hover:underline">Forgot password?</Link>
      </div>
      <Button type="submit" variant="royal" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-[13px] text-muted">Accounts are issued by the school office. There is no public sign-up.</p>
    </form>
  );
}
