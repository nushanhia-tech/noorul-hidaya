"use client";

import { useRef } from "react";
import { Button, type ButtonVariant, type ButtonSize } from "./button";

/**
 * A submit button that asks for confirmation in an accessible native dialog
 * before submitting its parent form (keeps working inside server-action forms).
 */
export function ConfirmSubmit({
  children, title, description, confirmLabel = "Confirm", variant = "danger", size = "md", name, value, className,
}: { children: React.ReactNode; title: string; description?: string; confirmLabel?: string; variant?: ButtonVariant; size?: ButtonSize; name?: string; value?: string; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const hidden = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => dialog.current?.showModal()}>
        {children}
      </Button>
      <button ref={hidden} type="submit" name={name} value={value} hidden />
      <dialog ref={dialog} className="m-auto w-[min(92vw,420px)] rounded-md border border-line bg-paper p-0 shadow-pop backdrop:bg-ink/30">
        <div className="p-5">
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-line bg-ivory px-5 py-3">
          <Button variant="ghost" onClick={() => dialog.current?.close()}>Cancel</Button>
          <Button variant={variant} onClick={() => { dialog.current?.close(); hidden.current?.click(); }}>{confirmLabel}</Button>
        </div>
      </dialog>
    </>
  );
}
