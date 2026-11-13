import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser, can } from "@/lib/auth/session";
import { buildOfficeReport, type ReportKind } from "@/lib/reports/office";
import { PdfBuilder, pdfResponse } from "@/lib/pdf/document";
import { getLetterhead } from "@/lib/pdf/letterhead";
import { formatDate, formatDateTime, todayISO } from "@/lib/format";

const KINDS: ReportKind[] = ["overview", "financial", "files", "tasks", "correspondence", "helpdesk"];

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorised", { status: 401 });
  const sp = request.nextUrl.searchParams;
  const kind = (sp.get("type") ?? "overview") as ReportKind;
  if (!KINDS.includes(kind)) return new NextResponse("Unknown report", { status: 400 });
  if (!can(user, kind === "financial" ? "finance.view" : ["office.reports", "files.view_all"])) return new NextResponse("Forbidden", { status: 403 });
  const from = sp.get("from") || `${todayISO().slice(0, 4)}-01-01`;
  const to = sp.get("to") || todayISO();
  const r = await buildOfficeReport(kind, from, to);
  const pdf = await PdfBuilder.create(await getLetterhead());
  pdf.title(r.title, `${formatDate(from)} to ${formatDate(to)}  |  Generated ${formatDateTime(new Date())}`);
  pdf.keyValues(r.stats.map((s) => [s.label, String(s.value)] as [string, string]), 3);
  if (r.chart) pdf.table([r.chart.x, r.chart.y], r.chart.data.map((d) => [String(d[r.chart!.x]), String(d[r.chart!.y])]), [3, 1], ["left", "right"]);
  for (const t of r.tables) { pdf.text(t.title, { size: 11, font: pdf.bold }); pdf.space(4); pdf.table(t.headers, t.rows, undefined, t.align); }
  pdf.footer(`${r.title} ${from} to ${to}`);
  return pdfResponse(await pdf.bytes(), `office-${kind}_${from}_${to}.pdf`);
}
