import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PdfBuilder, pdfResponse } from "@/lib/pdf/document";
import { getLetterhead } from "@/lib/pdf/letterhead";
import { formatDate } from "@/lib/format";

/** Printable outward letter on the college letterhead (RLS: letters.view). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return new NextResponse("Unauthorised", { status: 401 });
  const { data: l } = await db.from("letters").select("reference_no, direction, subject, body, recipient_name, recipient_address, letter_date").eq("id", id).maybeSingle();
  if (!l || l.direction !== "outward") return new NextResponse("Not found", { status: 404 });
  const pdf = await PdfBuilder.create(await getLetterhead());
  pdf.text(`Ref: ${l.reference_no}`, { size: 9.5 });
  pdf.text(`Date: ${formatDate(l.letter_date)}`, { size: 9.5 });
  pdf.space(14);
  pdf.text("To,", { size: 10.5 });
  pdf.text(l.recipient_name ?? "", { size: 10.5, font: pdf.bold });
  if (l.recipient_address) pdf.paragraph(l.recipient_address, 10.5);
  pdf.space(12);
  pdf.text(`Subject: ${l.subject}`, { size: 10.5, font: pdf.bold });
  pdf.space(10);
  pdf.paragraph(l.body ?? "", 10.5);
  pdf.footer(l.reference_no);
  return pdfResponse(await pdf.bytes(), `${l.reference_no.replace(/\//g, "-")}.pdf`, true);
}
