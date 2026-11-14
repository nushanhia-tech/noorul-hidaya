import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { pdfSafe, type Letterhead } from "./document";
import { DAY_NAMES, formatTime } from "@/lib/format";

export type GridSlot = { day: number; start: string; end: string; line1: string; line2: string; room: string };
export type GridPage = { title: string; subtitle: string; slots: GridSlot[] };

const W = 841.89, H = 595.28, M = 28; // A4 landscape
const INK = rgb(0.11, 0.1, 0.09), MUTED = rgb(0.43, 0.41, 0.38), LINE = rgb(0.72, 0.7, 0.66), HEAD = rgb(0.95, 0.94, 0.91), ACCENT = rgb(0.91, 0.42, 0.13);

function wrap(text: string, font: PDFFont, size: number, max: number, maxLines: number) {
  const words = pdfSafe(text).split(/\s+/); const lines: string[] = []; let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(t, size) > max && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  const out = lines.slice(0, maxLines).map((l) => { let s = l; while (s.length > 1 && font.widthOfTextAtSize(s, size) > max) s = s.slice(0, -1); return s; });
  if (lines.length > maxLines) out[maxLines - 1] = out[maxLines - 1].replace(/.{2}$/, "..");
  return out;
}

/** Printable weekly timetable: A4 landscape, days across, periods down, one page per class/teacher. */
export async function timetableGridPdf(letterhead: Letterhead, pages: GridPage[]) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  for (const pg of pages.length ? pages : [{ title: "Timetable", subtitle: "No periods scheduled", slots: [] }]) {
    const page = doc.addPage([W, H]);
    page.drawRectangle({ x: M, y: H - M - 3, width: 26, height: 3, color: ACCENT });
    page.drawText(pdfSafe(letterhead.collegeName), { x: M, y: H - M - 20, size: 13, font: bold, color: INK });
    page.drawText(pdfSafe(pg.title), { x: M, y: H - M - 40, size: 16, font: bold, color: INK });
    const sw = font.widthOfTextAtSize(pdfSafe(pg.subtitle), 9.5);
    page.drawText(pdfSafe(pg.subtitle), { x: W - M - sw, y: H - M - 20, size: 9.5, font, color: MUTED });

    const days = [1, 2, 3, 4, 5, 6].filter((d) => d <= 5 || pg.slots.some((s) => s.day === d));
    const periods = [...new Map(pg.slots.map((s) => [`${s.start}|${s.end}`, { start: s.start, end: s.end }])).values()].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
    const top = H - M - 54, timeW = 74, headH = 22;
    const colW = (W - M * 2 - timeW) / days.length;
    const rowH = periods.length ? Math.min(78, (top - M - headH - 14) / periods.length) : 60;

    page.drawRectangle({ x: M, y: top - headH, width: W - M * 2, height: headH, color: HEAD, borderColor: LINE, borderWidth: 0.7 });
    page.drawText("Time", { x: M + 6, y: top - 15, size: 9, font: bold, color: INK });
    days.forEach((d, i) => page.drawText(DAY_NAMES[d], { x: M + timeW + i * colW + 6, y: top - 15, size: 9.5, font: bold, color: INK }));

    periods.forEach((p, r) => {
      const y = top - headH - (r + 1) * rowH;
      page.drawRectangle({ x: M, y, width: W - M * 2, height: rowH, borderColor: LINE, borderWidth: 0.7 });
      page.drawText(pdfSafe(formatTime(p.start)), { x: M + 6, y: y + rowH - 15, size: 9, font: bold, color: INK });
      page.drawText(pdfSafe(`to ${formatTime(p.end)}`), { x: M + 6, y: y + rowH - 27, size: 8, font, color: MUTED });
      days.forEach((d, i) => {
        const x = M + timeW + i * colW;
        page.drawLine({ start: { x, y }, end: { x, y: y + rowH }, thickness: 0.7, color: LINE });
        const cell = pg.slots.filter((s) => s.day === d && s.start === p.start && s.end === p.end);
        let cy = y + rowH - 13;
        for (const s of cell) {
          for (const l of wrap(s.line1, bold, 8.5, colW - 10, 2)) { if (cy < y + 5) break; page.drawText(l, { x: x + 5, y: cy, size: 8.5, font: bold, color: INK }); cy -= 10; }
          for (const l of wrap([s.line2, s.room].filter(Boolean).join(" | "), font, 7.5, colW - 10, 2)) { if (cy < y + 5) break; page.drawText(l, { x: x + 5, y: cy, size: 7.5, font, color: MUTED }); cy -= 9; }
          cy -= 3;
        }
      });
    });
    if (!periods.length) page.drawText("No periods scheduled.", { x: M + 6, y: top - headH - 24, size: 10, font, color: MUTED });
    page.drawText(pdfSafe(`Printed ${new Date().toISOString().slice(0, 10)}`), { x: M, y: 14, size: 7.5, font, color: MUTED });
  }
  return doc.save();
}
