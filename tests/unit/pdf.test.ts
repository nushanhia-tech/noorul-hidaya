import { it, expect } from "vitest";
import { PdfBuilder } from "@/lib/pdf/document";
it("renders timetable pdf", async () => {
  const pdf = await PdfBuilder.create({ collegeName: "Test College", address: "Addr" });
  pdf.title("Class-wise timetable", "Odd 2026-27");
  for (let b = 0; b < 6; b++) {
    pdf.ensure(90); pdf.text(`Batch ${b}`, { size: 12, font: pdf.bold });
    pdf.table(["Day", "Time", "Subject", "Teacher", "Room"], Array.from({ length: 14 }, (_, i) => ["Monday", "9:30 am - 10:30 am", `ARB10${i} - A very long subject title that must be truncated properly`, "Teacher Name", "R1"]), [1.1, 1.6, 3, 2.2, 1]);
  }
  pdf.footer("x");
  const bytes = await pdf.bytes();
  expect(bytes.length).toBeGreaterThan(2000);
  expect(pdf.doc.getPageCount()).toBeGreaterThan(1);
});
