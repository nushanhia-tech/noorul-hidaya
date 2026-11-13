import { describe, expect, it } from "vitest";
import { canEnterPortal, isSafeNext, portalForRole, portalFromPath, portalsForRoles, postLoginDestination } from "@/lib/auth/roles";
import { hasPermission } from "@/lib/auth/permissions";

describe("role → portal routing", () => {
  it("maps every office role to the office portal", () => {
    for (const r of ["office_clerk", "office_superintendent", "accountant", "office_supervisor"] as const) expect(portalForRole(r)).toBe("office");
  });
  it("sends single-portal users straight to their portal", () => {
    expect(postLoginDestination(["student"])).toBe("/portal/student");
    expect(postLoginDestination(["accountant", "office_clerk"])).toBe("/portal/office");
  });
  it("asks multi-portal users to choose", () => {
    expect(postLoginDestination(["faculty", "parent"])).toBe("/select-role");
  });
  it("honours a safe next path only within an authorised portal", () => {
    expect(postLoginDestination(["student"], "/portal/student/fees")).toBe("/portal/student/fees");
    expect(postLoginDestination(["student"], "/portal/admin/users")).toBe("/portal/student");
    expect(postLoginDestination(["student"], "https://evil.example")).toBe("/portal/student");
    expect(postLoginDestination(["student"], "//evil.example")).toBe("/portal/student");
  });
  it("rejects users without roles", () => expect(postLoginDestination([])).toBe("/login?error=no_role"));
  it("blocks portals the user does not hold", () => {
    expect(canEnterPortal(["student"], "admin")).toBe(false);
    expect(canEnterPortal(["parent", "faculty"], "faculty")).toBe(true);
    expect(portalsForRoles(["admin", "accountant"])).toEqual(["admin", "office"]);
  });
  it("parses portals from paths", () => {
    expect(portalFromPath("/portal/office/files/1")).toBe("office");
    expect(portalFromPath("/portal/account")).toBeNull();
  });
  it("detects open-redirect attempts", () => {
    expect(isSafeNext("/portal/student")).toBe(true);
    expect(isSafeNext("//x.com")).toBe(false);
    expect(isSafeNext("/\\x.com")).toBe(false);
    expect(isSafeNext("http://x.com")).toBe(false);
  });
  it("checks permissions", () => {
    expect(hasPermission(new Set(["finance.view"]), "finance.view")).toBe(true);
    expect(hasPermission(["finance.view"], ["finance.collect", "finance.correct"])).toBe(false);
    expect(hasPermission(["finance.correct"], ["finance.collect", "finance.correct"])).toBe(true);
  });
});
