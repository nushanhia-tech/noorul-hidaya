/** Permission keys. The authoritative mapping lives in the database
 *  (role_permissions) and is editable by administrators; RLS uses it too. */
export const PERMISSIONS = [
  "users.manage", "roles.manage", "academics.manage", "cms.manage", "settings.manage",
  "notices.publish", "results.publish", "reports.admin", "students.lookup",
  "files.manage", "files.view_all", "files.archive",
  "finance.view", "finance.collect", "finance.correct", "finance.concessions", "finance.structures",
  "tasks.assign", "tasks.view_all",
  "letters.view", "letters.manage",
  "helpdesk.handle", "helpdesk.view_all", "helpdesk.supervise", "parents.respond",
  "office.reports",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export function hasPermission(granted: Iterable<string>, needed: Permission | Permission[]): boolean {
  const set = granted instanceof Set ? (granted as Set<string>) : new Set(granted);
  const list = Array.isArray(needed) ? needed : [needed];
  return list.some((p) => set.has(p));
}
