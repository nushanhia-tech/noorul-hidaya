/** Pure role/portal logic shared by server code, UI and tests. */
export const ROLES = [
  "student", "faculty", "parent", "admin",
  "office_clerk", "office_superintendent", "accountant", "office_supervisor",
] as const;
export type Role = (typeof ROLES)[number];

export const OFFICE_ROLES: Role[] = ["office_clerk", "office_superintendent", "accountant", "office_supervisor"];
export const PRIVILEGED_ROLES: Role[] = ["admin", "accountant", "office_superintendent", "office_supervisor"];

export type Portal = "student" | "faculty" | "parent" | "admin" | "office";
export const PORTALS: Portal[] = ["student", "faculty", "parent", "admin", "office"];

export const ROLE_LABELS: Record<Role, string> = {
  student: "Student",
  faculty: "Teacher",
  parent: "Parent",
  admin: "Administrator",
  office_clerk: "Office Clerk",
  office_superintendent: "Office Superintendent",
  accountant: "Accountant",
  office_supervisor: "Office Supervisor",
};

export const PORTAL_LABELS: Record<Portal, string> = {
  student: "Student Portal",
  faculty: "Teacher Portal",
  parent: "Parent Portal",
  admin: "Admin Portal",
  office: "Office Portal",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function portalForRole(role: Role): Portal {
  if (OFFICE_ROLES.includes(role)) return "office";
  return role as Portal;
}

export function portalsForRoles(roles: Role[]): Portal[] {
  const set = new Set(roles.map(portalForRole));
  return PORTALS.filter((p) => set.has(p));
}

export function canEnterPortal(roles: Role[], portal: Portal): boolean {
  return portalsForRoles(roles).includes(portal);
}

export function portalPath(portal: Portal) {
  return `/portal/${portal}`;
}

/** Where to send a user straight after sign-in. */
export function postLoginDestination(roles: Role[], next?: string | null): string {
  const portals = portalsForRoles(roles);
  if (portals.length === 0) return "/login?error=no_role";
  if (next && isSafeNext(next)) {
    const target = portalFromPath(next);
    if (!target || portals.includes(target) || next.startsWith("/portal/account")) return next;
  }
  if (portals.length === 1) return portalPath(portals[0]);
  return "/select-role";
}

export function portalFromPath(path: string): Portal | null {
  const m = /^\/portal\/(student|faculty|parent|admin|office)(\/|$)/.exec(path);
  return m ? (m[1] as Portal) : null;
}

/** Only allow same-origin relative paths (prevents open redirects). */
export function isSafeNext(next: string): boolean {
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") && !next.includes("://");
}
