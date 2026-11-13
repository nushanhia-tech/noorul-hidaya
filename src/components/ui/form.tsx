import { cn } from "@/lib/utils";

const control =
  "w-full rounded-sm border border-line-strong bg-white px-3 text-[15px] sm:text-sm text-ink placeholder:text-faint transition-colors focus:border-royal focus:outline-none focus:ring-2 focus:ring-royal/15 disabled:bg-sand disabled:text-muted aria-[invalid=true]:border-danger";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, "h-10", props.type === "file" && "h-auto py-2 file:mr-3 file:rounded-xs file:border-0 file:bg-sand file:px-3 file:py-1.5 file:text-sm file:font-medium", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "min-h-24 py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(control, "h-10 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%236b675f%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:12px] bg-[right_0.75rem_center] bg-no-repeat pr-9", className)}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-[13px] font-medium text-ink-soft", className)} {...props} />;
}

export function Field({
  label, htmlFor, hint, error, required, className, children,
}: { label: string; htmlFor?: string; hint?: string; error?: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-0.5 text-accent" aria-hidden>*</span>}
      </Label>
      {children}
      {error ? (
        <p className="mt-1.5 text-[13px] text-danger" role="alert">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[13px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Checkbox({ label, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2.5 text-sm text-ink-soft", className)}>
      <input type="checkbox" className="mt-0.5 h-4 w-4 rounded-xs border-line-strong accent-[var(--color-accent)]" {...props} />
      <span>{label}</span>
    </label>
  );
}

export function FormGrid({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("grid gap-4 sm:grid-cols-2", className)}>{children}</div>;
}
