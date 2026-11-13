"use client";
import { Field } from "./form";
import { useFieldError } from "./action-form";

/** Field wired to the surrounding ActionForm's server-side field errors. */
export function F(props: { name: string; label: string; hint?: string; required?: boolean; className?: string; children: React.ReactNode }) {
  const error = useFieldError(props.name);
  return (
    <Field label={props.label} htmlFor={props.name} hint={props.hint} required={props.required} error={error} className={props.className}>
      {props.children}
    </Field>
  );
}
