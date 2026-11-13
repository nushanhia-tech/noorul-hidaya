import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PdfBuilder, pdfResponse } from "@/lib/pdf/document";
import { getLetterhead } from "@/lib/pdf/letterhead";
import { formatMoney } from "@/lib/fees";
import { formatDateTime } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/constants";

/** Receipt PDF for a verified payment (id = payment id). Visibility enforced by RLS. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse("Unauthorised", { status: 401 });
  const { data: p } = await supabase.from("payments")
    .select("id, amount, method, mode, status, paid_at, reference_no, provider_payment_id, receipts(receipt_no, issued_at), invoices(invoice_no, title), students(register_no, profiles(full_name), programmes(name))")
    .eq("id", id).maybeSingle();
  if (!p) return new NextResponse("Not found", { status: 404 });
  const receipt = (Array.isArray(p.receipts) ? p.receipts[0] : p.receipts) as { receipt_no: string; issued_at: string } | null;
  if (p.status !== "verified" || !receipt) return new NextResponse("No receipt has been issued for this payment", { status: 409 });
  const inv = p.invoices as unknown as { invoice_no: string; title: string };
  const st = p.students as unknown as { register_no: string; profiles: { full_name: string }; programmes: { name: string } | null };
  const sandbox = p.mode === "sandbox";

  const pdf = await PdfBuilder.create(await getLetterhead(), { watermark: sandbox ? "SANDBOX - NOT A VALID RECEIPT" : undefined });
  pdf.title(sandbox ? "Test receipt (sandbox)" : "Fee receipt", `Receipt ${receipt.receipt_no}  |  Issued ${formatDateTime(receipt.issued_at)}`);
  pdf.keyValues([
    ["Student", st.profiles.full_name], ["Register number", st.register_no],
    ["Programme", st.programmes?.name ?? "-"], ["Invoice", inv.invoice_no],
  ]);
  pdf.table(["Description", "Method", "Reference", "Amount"], [[
    inv.title, PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS] ?? p.method,
    p.reference_no ?? p.provider_payment_id ?? "-", formatMoney(p.amount),
  ]], [3, 1.4, 1.8, 1.3], ["left", "left", "left", "right"]);
  pdf.text(`Amount received: ${formatMoney(p.amount)}`, { size: 12, font: pdf.bold });
  pdf.text(`Payment date: ${formatDateTime(p.paid_at)}`, { size: 9.5 });
  pdf.space(30);
  pdf.text(sandbox ? "This document was produced in sandbox test mode. No money was received." : "This is a computer-generated receipt for a verified payment.", { size: 8.5 });
  pdf.footer(`${receipt.receipt_no}`);
  return pdfResponse(await pdf.bytes(), `${receipt.receipt_no.replace(/\//g, "-")}.pdf`);
}
