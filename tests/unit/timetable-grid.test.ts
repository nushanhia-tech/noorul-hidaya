import { it, expect } from "vitest";
import { writeFileSync } from "fs";
import { PDFDocument } from "pdf-lib";
import { timetableGridPdf } from "@/lib/pdf/timetable-grid";

it("renders a landscape timetable grid, one page per class", async () => {
  const times = [["09:30:00", "10:15:00"], ["10:15:00", "11:00:00"], ["11:15:00", "12:00:00"], ["12:00:00", "12:45:00"], ["13:30:00", "14:15:00"], ["14:15:00", "15:00:00"]];
  const subjects = ["Arabic Grammar", "English", "Mathematics", "Islamic Studies", "Social Science and Civics", "Science"];
  const slots = [1, 2, 3, 4, 5, 6].flatMap((day) => times.map(([start, end], i) => ({ day, start, end, line1: subjects[(i + day) % 6], line2: "Teacher Name", room: "R12" })));
  const bytes = await timetableGridPdf({ collegeName: "Test School" }, [{ title: "Class 8 A", subtitle: "Term 1", slots }, { title: "Class 9 B", subtitle: "Term 1", slots: [] }]);
  const doc = await PDFDocument.load(bytes);
  expect(doc.getPageCount()).toBe(2);
  const { width, height } = doc.getPage(0).getSize();
  expect(width).toBeGreaterThan(height); // landscape
  if (process.env.PDF_OUT) writeFileSync(process.env.PDF_OUT, bytes);
});
