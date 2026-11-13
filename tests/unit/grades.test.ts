import { describe, expect, it } from "vitest";
import { distribution, gradeFor, sgpa, validateMark } from "@/lib/grades";

describe("grades", () => {
  it("maps percentages to the 10-point scale (matches public.grade_for)", () => {
    expect(gradeFor(95)).toEqual({ grade: "O", point: 10 });
    expect(gradeFor(84)).toEqual({ grade: "A+", point: 9 });
    expect(gradeFor(60)).toEqual({ grade: "B+", point: 7 });
    expect(gradeFor(42)).toEqual({ grade: "P", point: 4 });
    expect(gradeFor(39.99)).toEqual({ grade: "F", point: 0 });
    expect(gradeFor(null)).toEqual({ grade: "F", point: 0 });
    expect(gradeFor(47, 50)).toEqual({ grade: "F", point: 0 });
  });
  it("computes credit-weighted SGPA", () => {
    expect(sgpa([{ credits: 4, grade_point: 9 }, { credits: 2, grade_point: 6 }])).toBe(8);
    expect(sgpa([])).toBeNull();
  });
  it("validates mark entry", () => {
    expect(validateMark("42.5", 50)).toEqual({ marks: 42.5, absent: false });
    expect(validateMark("ab", 50)).toEqual({ marks: null, absent: true });
    expect(validateMark("", 50)).toEqual({ marks: null, absent: false });
    expect(validateMark("51", 50).error).toMatch(/Max 50/);
    expect(validateMark("-1", 50).error).toMatch(/negative/);
    expect(validateMark("x", 50).error).toBeTruthy();
    expect(validateMark("1.234", 50).error).toMatch(/decimals/);
  });
  it("builds grade distributions in scale order", () => {
    expect(distribution(["A", "F", "A", "O"]).filter((d) => d.count)).toEqual([{ grade: "O", count: 1 }, { grade: "A", count: 2 }, { grade: "F", count: 1 }]);
  });
});
