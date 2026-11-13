import Link from "next/link";
import { cn } from "@/lib/utils";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 select-none";
const variants = {
  primary: "bg-accent text-white hover:bg-accent-600 active:bg-accent-700",
  dark: "bg-ink text-white hover:bg-ink-soft",
  royal: "bg-royal text-white hover:bg-royal-600",
  outline: "border border-line-strong bg-paper text-ink hover:bg-white hover:border-ink/30",
  subtle: "bg-sand text-ink hover:bg-line",
  ghost: "text-ink-soft hover:bg-sand hover:text-ink",
  danger: "bg-danger text-white hover:bg-danger/90",
  link: "text-royal underline-offset-4 hover:underline px-0",
} as const;
const sizes = {
  sm: "h-8 px-3 text-[13px] rounded-sm",
  md: "h-10 px-4 text-sm rounded-sm",
  lg: "h-12 px-5 text-[15px] rounded-sm",
  icon: "h-9 w-9 rounded-sm",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(base, variants[variant], variant === "link" ? "h-auto" : sizes[size], className);
}

export function Button({
  variant = "primary", size = "md", className, type = "button", ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
  variant = "primary", size = "md", className, ...props
}: React.ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
