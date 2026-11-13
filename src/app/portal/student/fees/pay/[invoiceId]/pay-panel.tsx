"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import { completeSandboxPayment, markPaymentAbandoned, startOnlinePayment, verifyRazorpayPayment } from "@/lib/payments/actions";

declare global {
  interface Window { Razorpay?: new (opts: Record<string, unknown>) => { open: () => void } }
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export function PayPanel({ invoiceId, outstanding, sandbox }: { invoiceId: string; outstanding: number; sandbox: boolean }) {
  const router = useRouter();
  const [amount, setAmount] = useState(outstanding.toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const [sandboxOrder, setSandboxOrder] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const begin = () => start(async () => {
    setError(null);
    const res = await startOnlinePayment(invoiceId, Number(amount));
    if (!res.ok) return setError(res.error);
    if (res.provider === "sandbox") return setSandboxOrder(res.orderId);
    if (!(await loadRazorpay()) || !window.Razorpay) return setError("Could not load the payment window. Check your connection and try again.");
    const rz = new window.Razorpay({
      key: res.key, order_id: res.orderId, amount: res.amountMinor, currency: res.currency, name: res.name,
      prefill: { email: res.email }, theme: { color: "#e8691e" },
      handler: async (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        const v = await verifyRazorpayPayment({ orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature });
        router.push(v.ok ? "/portal/student/fees?paid=1" : "/portal/student/fees?failed=1");
        router.refresh();
      },
      modal: { ondismiss: () => { void markPaymentAbandoned(res.orderId); } },
    });
    rz.open();
  });

  const simulate = (outcome: "success" | "failure") => start(async () => {
    const r = await completeSandboxPayment(sandboxOrder!, outcome);
    if (!r.ok) return setError(r.error);
    router.push(outcome === "success" ? "/portal/student/fees?paid=1" : "/portal/student/fees?failed=1");
    router.refresh();
  });

  return (
    <div className="space-y-4">
      {sandbox && (
        <Notice tone="danger" title="SANDBOX / TEST MODE">
          No real money moves. Simulated payments are marked &ldquo;sandbox&rdquo;, their receipts are watermarked as not valid, and they never reduce your real balance.
        </Notice>
      )}
      {error && <Notice tone="danger">{error}</Notice>}
      {!sandboxOrder ? (
        <>
          <Field label="Amount to pay" htmlFor="amount" hint="You may pay part of the balance.">
            <Input id="amount" type="number" inputMode="decimal" min="1" step="0.01" max={outstanding} value={amount} onChange={(e) => setAmount(e.target.value)} className="tabular" />
          </Field>
          <Button size="lg" className="w-full" disabled={pending} onClick={begin}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Continue to secure payment
          </Button>
        </>
      ) : (
        <div className="rounded-sm border border-dashed border-danger/40 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-danger"><FlaskConical className="h-4 w-4" /> Sandbox order {sandboxOrder.slice(0, 22)}…</p>
          <p className="mt-1 text-[13px] text-muted">Choose the outcome the test gateway should report.</p>
          <div className="mt-3 flex gap-2">
            <Button variant="dark" disabled={pending} onClick={() => simulate("success")}>Simulate success</Button>
            <Button variant="outline" disabled={pending} onClick={() => simulate("failure")}>Simulate failure</Button>
          </div>
        </div>
      )}
    </div>
  );
}
