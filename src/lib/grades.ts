/** 10-point grading scale. Must match public.grade_for() in the database. */
export const GRADE_SCALE = [
  { min: 90, grade: "O", point: 10, label: "Outstanding" },
  { min: 80, grade: "A+", point: 9, label: "Excellent" },
  { min: 70, grade: "A", point: 8, label: "Very good" },
  { min: 60, grade: "B+", point: 7, label: "Good" },
  { min: 50, grade: "B", point: 6, label: "Above average" },
  { min: 45, grade: "C", point: 5, label: "Average" },
] as const;

export function gradeFor(percent: number | null, passPercent = 40): { grade: string; point: number } {
  if (percent === null || Number.isNaN(percent) || percent < passPercent) return { grade: "F", point: 0 };
  for (const g of GRADE_SCALE) if (percent >= g.min) return { grade: g.grade, point: g.point };
  return { grade: "P", point: 4 };
}

/** Credit-weighted grade point average. */
export function sgpa(rows: { credits: number; grade_point: number }[]): number | null {
  const credits = rows.reduce((s, r) => s + Number(r.credits), 0);
  if (!credits) return null;
  const weighted = rows.reduce((s, r) => s + Number(r.credits) * Number(r.grade_point), 0);
  return Math.round((weighted / credits) * 100) / 100;
}

export function validateMark(value: string, max: number): { marks: number | null; absent: boolean; error?: string } {
  const v = value.trim().toUpperCase();
  if (v === "") return { marks: null, absent: false };
  if (v === "AB" || v === "A") return { marks: null, absent: true };
  const n = Number(v);
  if (!Number.isFinite(n)) return { marks: null, absent: false, error: "Enter a number or AB" };
  if (n < 0) return { marks: null, absent: false, error: "Cannot be negative" };
  if (n > max) return { marks: null, absent: false, error: `Max ${max}` };
  if (Math.round(n * 100) !== n * 100) return { marks: null, absent: false, error: "Max 2 decimals" };
  return { marks: n, absent: false };
}

export function distribution(grades: string[]) {
  const order = ["O", "A+", "A", "B+", "B", "C", "P", "F"];
  const counts = Object.fromEntries(order.map((g) => [g, 0])) as Record<string, number>;
  for (const g of grades) if (g in counts) counts[g]++;
  return order.map((g) => ({ grade: g, count: counts[g] }));
}
