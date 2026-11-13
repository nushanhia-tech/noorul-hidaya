import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, can } from "@/lib/auth/session";
import { PdfBuilder, pdfResponse } from "@/lib/pdf/document";
import { getLetterhead } from "@/lib/pdf/letterhead";
import { collectionTotals, formatMoney } from "@/lib/fees";
import { formatDate, formatDateTime, todayISO } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/constants";

/** Collection report PDF (verified live payments only). */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorised", { status: 401 });
  if (!can(user, "finance.view")) return new NextResponse("Forbidden", { status: 403 });
  const from = request.nextUrl.searchParams.get("from") || `${todayISO().slice(0, 7)}-01`;
  const to = request.nextUrl.searchParams.get("to") || todayISO();
  const db = await createClient();
  const { data } = await db.from("payments").select("amount, status, mode, method, paid_at, reference_no, receipts(receipt_no), students(register_no, profiles(full_name))")
    .eq("status", "verified").eq("mode", "live").gte("paid_at", `${from}T00:00:00`).lte("paid_at", `${to}T23:59:59.999`).order("paid_at");
  const rows = (data ?? []) as unknown as { amount: number; status: string; mode: string; method: string; paid_at: string; reference_no: string | null; receipts: { receipt_no: string } | { receipt_no: string }[] | null; students: { register_no: string; profiles: { full_name: string } } }[];
  const t = collectionTotals(rows);
  const pdf = await PdfBuilder.create(await getLetterhead());
  pdf.title("Fee collection report", `${formatDate(from)} to ${formatDate(to)}  |  Generated ${formatDateTime(new Date())} by ${user.fullName}`);
  pdf.keyValues([["Total collected", formatMoney(t.total)], ["Number of payments", String(t.count)]]);
  pdf.table(["Method", "Amount"], Object.entries(t.byMethod).map(([m, v]) => [PAYMENT_METHODS[m as keyof typeof PAYMENT_METHODS] ?? m, formatMoney(v)]), [3, 1], ["left", "right"]);
  pdf.table(["Date", "Receipt", "Student", "Method", "Amount"], rows.map((r) => {
    const rc = Array.isArray(r.receipts) ? r.receipts[0] : r.receipts;
    return [formatDate(r.paid_at), rc?.receipt_no ?? "", `${r.students.profiles.full_name} (${r.students.register_no})`, r.method, formatMoney(r.amount)];
  }), [1.1, 1.5, 2.6, 1, 1.1], ["left", "left", "left", "left", "right"]);
  pdf.footer(`Collection report ${from} to ${to}`);
  return pdfResponse(await pdf.bytes(), `collections_${from}_${to}.pdf`);
}
