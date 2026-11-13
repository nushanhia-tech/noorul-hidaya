"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import { confirmTotpEnrolment, removeFactor, startTotpEnrolment } from "../actions";

export function MfaManager({ mode, factorId }: { mode: "enrol" | "remove"; factorId?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [enrol, setEnrol] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");

  if (mode === "remove") {
    return (
      <div className="text-right">
        <Button variant="outline" size="sm" disabled={pending} onClick={() => start(async () => {
          const r = await removeFactor(factorId!);
          setMsg(r.ok ? null : { ok: false, text: r.error });
          if (r.ok) router.refresh();
        })}>Remove</Button>
        {msg && <p className="mt-1 text-xs text-danger">{msg.text}</p>}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {msg && <Notice tone={msg.ok ? "success" : "danger"}>{msg.text}</Notice>}
      {!enrol ? (
        <Button variant="dark" disabled={pending} onClick={() => start(async () => {
          const r = await startTotpEnrolment();
          if (r.ok) setEnrol(r); else setMsg({ ok: false, text: r.error });
        })}>Set up authenticator</Button>
      ) : (
        <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrol.qr} alt="QR code for your authenticator app" className="h-[180px] w-[180px] rounded-sm border border-line bg-white p-2" />
          <div className="space-y-3 text-sm">
            <p>Scan the QR code with Google Authenticator, Microsoft Authenticator or a similar app, then enter the 6-digit code it shows.</p>
            <p className="text-xs text-muted">Can&rsquo;t scan? Enter this key: <code className="break-all rounded-xs bg-sand px-1.5 py-0.5">{enrol.secret}</code></p>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => {
              const r = await confirmTotpEnrolment(enrol.factorId, code);
              setMsg(r.ok ? { ok: true, text: r.message ?? "Enabled" } : { ok: false, text: r.error });
              if (r.ok) { setEnrol(null); router.refresh(); }
            }); }}>
              <Input aria-label="6-digit code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" className="tabular max-w-36 tracking-[0.3em]" />
              <Button type="submit" variant="royal" disabled={pending || code.length !== 6}>Verify</Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
