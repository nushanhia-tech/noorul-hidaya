import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/** Small layout engine on top of pdf-lib for receipts, statements, letters and reports. */
const INK = rgb(0.11, 0.1, 0.09);
const MUTED = rgb(0.43, 0.41, 0.38);
const LINE = rgb(0.86, 0.84, 0.8);
const ACCENT = rgb(0.91, 0.42, 0.13);

export type Letterhead = { collegeName: string; address?: string | null; phone?: string | null; email?: string | null };

/** Standard PDF fonts are WinAnsi-only; replace characters they cannot encode. */
export function pdfSafe(s: string | number | null | undefined) {
  return String(s ?? "")
    .replace(/₹/g, "Rs. ")
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "?");
}

export class PdfBuilder {
  doc!: PDFDocument;
  page!: PDFPage;
  font!: PDFFont;
  bold!: PDFFont;
  y = 0;
  readonly margin = 50;
  readonly width = 595.28;
  readonly height = 841.89;
  private letterhead!: Letterhead;
  watermark?: string;

  static async create(letterhead: Letterhead, opts: { watermark?: string } = {}) {
    const b = new PdfBuilder();
    b.doc = await PDFDocument.create();
    b.font = await b.doc.embedFont(StandardFonts.Helvetica);
    b.bold = await b.doc.embedFont(StandardFonts.HelveticaBold);
    b.letterhead = letterhead;
    b.watermark = opts.watermark;
    b.doc.setTitle(letterhead.collegeName);
    b.doc.setProducer("School Management System");
    b.newPage();
    return b;
  }

  newPage() {
    this.page = this.doc.addPage([this.width, this.height]);
    this.y = this.height - this.margin;
    const lh = this.letterhead;
    this.page.drawRectangle({ x: this.margin, y: this.y - 4, width: 28, height: 3, color: ACCENT });
    this.y -= 22;
    this.text(lh.collegeName, { size: 16, font: this.bold });
    const contact = [lh.address, lh.phone, lh.email].filter(Boolean).join("  |  ");
    if (contact) this.text(contact, { size: 8.5, color: MUTED });
    this.y -= 6;
    this.rule();
    if (this.watermark) {
      this.page.drawText(pdfSafe(this.watermark), {
        x: 70, y: 300, size: 44, font: this.bold, color: rgb(0.85, 0.2, 0.15), opacity: 0.18, rotate: { type: "degrees", angle: 35 } as never,
      });
    }
  }

  ensure(space: number) {
    if (this.y - space < this.margin + 30) this.newPage();
  }

  text(s: string, o: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; x?: number; gap?: number } = {}) {
    const size = o.size ?? 10;
    const font = o.font ?? this.font;
    const maxWidth = this.width - this.margin - (o.x ?? this.margin);
    for (const line of this.wrap(pdfSafe(s), font, size, maxWidth)) {
      this.ensure(size + 4);
      this.page.drawText(line, { x: o.x ?? this.margin, y: this.y - size, size, font, color: o.color ?? INK });
      this.y -= size + (o.gap ?? 4);
    }
  }

  paragraph(s: string, size = 10.5) {
    for (const para of pdfSafe(s).split(/\n/)) {
      if (!para.trim()) { this.y -= size; continue; }
      this.text(para, { size, gap: 5 });
    }
  }

  wrap(s: string, font: PDFFont, size: number, maxWidth: number) {
    const words = s.split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (font.widthOfTextAtSize(test, size) > maxWidth && line) { lines.push(line); line = w; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }

  space(n = 10) { this.y -= n; }

  rule() {
    this.page.drawLine({ start: { x: this.margin, y: this.y }, end: { x: this.width - this.margin, y: this.y }, thickness: 0.6, color: LINE });
    this.y -= 14;
  }

  title(s: string, sub?: string) {
    this.space(4);
    this.text(s, { size: 14, font: this.bold });
    if (sub) this.text(sub, { size: 9, color: MUTED });
    this.space(6);
  }

  keyValues(rows: [string, string][], columns = 2) {
    const colWidth = (this.width - this.margin * 2) / columns;
    for (let i = 0; i < rows.length; i += columns) {
      this.ensure(30);
      const top = this.y;
      rows.slice(i, i + columns).forEach(([k, v], j) => {
        const x = this.margin + j * colWidth;
        this.page.drawText(pdfSafe(k).toUpperCase(), { x, y: top - 8, size: 7, font: this.bold, color: MUTED });
        this.page.drawText(pdfSafe(v).slice(0, 60), { x, y: top - 21, size: 10, font: this.font, color: INK });
      });
      this.y = top - 32;
    }
  }

  table(headers: string[], rows: (string | number)[][], widths?: number[], align?: ("left" | "right")[]) {
    const total = this.width - this.margin * 2;
    const w = widths ?? headers.map(() => total / headers.length);
    const scale = total / w.reduce((a, b) => a + b, 0);
    const cols = w.map((x) => x * scale);
    const drawRow = (cells: (string | number)[], font: PDFFont, size: number, shade: boolean) => {
      this.ensure(20);
      if (shade) this.page.drawRectangle({ x: this.margin, y: this.y - 16, width: total, height: 18, color: rgb(0.96, 0.95, 0.93) });
      let x = this.margin;
      cells.forEach((c, i) => {
        let s = pdfSafe(c);
        while (s.length > 1 && font.widthOfTextAtSize(s, size) > cols[i] - 8) s = s.slice(0, -2) + ".";
        const tw = font.widthOfTextAtSize(s, size);
        const tx = align?.[i] === "right" ? x + cols[i] - tw - 4 : x + 4;
        this.page.drawText(s, { x: tx, y: this.y - 12, size, font, color: INK });
        x += cols[i];
      });
      this.y -= 19;
    };
    drawRow(headers, this.bold, 8.5, true);
    rows.forEach((r) => drawRow(r, this.font, 9, false));
    this.page.drawLine({ start: { x: this.margin, y: this.y + 2 }, end: { x: this.margin + total, y: this.y + 2 }, thickness: 0.6, color: LINE });
    this.space(8);
  }

  footer(note: string) {
    const pages = this.doc.getPages();
    pages.forEach((p, i) => {
      p.drawText(pdfSafe(`${note}   |   Page ${i + 1} of ${pages.length}`), { x: this.margin, y: 28, size: 7.5, font: this.font, color: MUTED });
    });
  }

  async bytes() {
    return this.doc.save();
  }
}

export function pdfResponse(bytes: Uint8Array, filename: string, inline = false) {
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename.replace(/[^\w.-]/g, "_")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
