import { describe, expect, it } from "vitest";
import { checkUpload, safeFileName, sniffMime } from "@/lib/uploads";
import { toCsv } from "@/lib/csv";
import { hmacSha256Hex, verifyRazorpayCheckout, verifyRazorpayWebhook } from "@/lib/payments/signature";
import { pdfSafe } from "@/lib/pdf/document";
import { slugify } from "@/lib/format";

const bytes = (...b: number[]) => new Uint8Array(b);
const PDF = new TextEncoder().encode("%PDF-1.7 rest");
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const EXE = bytes(0x4d, 0x5a, 0x90, 0x00);
const DOCX = new TextEncoder().encode("PK\u0003\u0004....[Content_Types].xml word/document.xml");

describe("upload validation", () => {
  it("identifies files by their contents", () => {
    expect(sniffMime(PDF)).toBe("application/pdf");
    expect(sniffMime(PNG)).toBe("image/png");
    expect(sniffMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffMime(DOCX)).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(sniffMime(EXE)).toBeNull();
    expect(sniffMime(new TextEncoder().encode("PK\u0003\u0004 random.zip"))).toBeNull();
  });
  it("accepts allowed files and rejects disguised or oversized ones", () => {
    expect(checkUpload({ name: "a.pdf", size: 100, type: "application/pdf" }, PDF)).toMatchObject({ ok: true, mime: "application/pdf" });
    expect(checkUpload({ name: "virus.pdf", size: 100, type: "application/pdf" }, EXE)).toMatchObject({ ok: false });
    expect(checkUpload({ name: "x.png", size: 100, type: "image/png" }, PDF)).toMatchObject({ ok: false, error: expect.stringMatching(/do not match/) });
    expect(checkUpload({ name: "a.pdf", size: 11 * 1024 * 1024, type: "application/pdf" }, PDF)).toMatchObject({ ok: false, error: expect.stringMatching(/too large/) });
    expect(checkUpload({ name: "a.pdf", size: 0, type: "application/pdf" }, PDF)).toMatchObject({ ok: false });
    expect(checkUpload({ name: "a.pdf", size: 10, type: "application/pdf" }, PDF, { allowed: ["image/png"] })).toMatchObject({ ok: false });
  });
  it("produces safe storage names", () => {
    expect(safeFileName("../../etc/passwd Report (final).pdf", "pdf")).toBe("etcpasswd-Report-final.pdf");
    expect(safeFileName("....", "pdf")).toBe("document.pdf");
  });
});

describe("CSV export", () => {
  it("escapes quotes, commas and spreadsheet formulas", () => {
    expect(toCsv(["a", "b"], [["x,y", 'he said "hi"'], ["=HYPERLINK(1)", -5]])).toBe('a,b\r\n"x,y","he said ""hi"""\r\n\'=HYPERLINK(1),-5\r\n');
  });
});

describe("payment signatures", () => {
  it("verifies Razorpay checkout and webhook signatures", () => {
    const sig = hmacSha256Hex("order_1|pay_1", "secret");
    expect(verifyRazorpayCheckout("order_1", "pay_1", sig, "secret")).toBe(true);
    expect(verifyRazorpayCheckout("order_1", "pay_2", sig, "secret")).toBe(false);
    expect(verifyRazorpayCheckout("order_1", "pay_1", sig, "")).toBe(false);
    const body = '{"event":"payment.captured"}';
    expect(verifyRazorpayWebhook(body, hmacSha256Hex(body, "wh"), "wh")).toBe(true);
    expect(verifyRazorpayWebhook(body + " ", hmacSha256Hex(body, "wh"), "wh")).toBe(false);
    expect(verifyRazorpayWebhook(body, "zz-not-hex", "wh")).toBe(false);
  });
});

describe("text helpers", () => {
  it("makes PDF text encodable", () => expect(pdfSafe("₹1,000 – “ok”")).toBe('Rs. 1,000 - "ok"'));
  it("slugifies", () => expect(slugify("  Annual Day 2026: Highlights! ")).toBe("annual-day-2026-highlights"));
});
