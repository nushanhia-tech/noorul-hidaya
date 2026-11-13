import { redirect } from "next/navigation";
import { ArrowRight, Briefcase, GraduationCap, LayoutDashboard, School, Users } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { requireUser, enforceMfa } from "@/lib/auth/session";
import { PORTAL_LABELS, portalPath, type Portal } from "@/lib/auth/roles";
import { choosePortal } from "../login/actions";

export const metadata = { title: "Choose a portal" };

const ICONS: Record<Portal, React.ComponentType<{ className?: string }>> = {
  student: GraduationCap, faculty: School, parent: Users, admin: LayoutDashboard, office: Briefcase,
};
const DESCRIPTIONS: Record<Portal, string> = {
  student: "Timetable, results, fees, materials and help desk",
  faculty: "Courses, marks entry, resources and reports",
  parent: "Your ward's results, fees and notices",
  admin: "Users, academics, website and settings",
  office: "Files, accounts, tasks, letters and help desk",
};

export default async function SelectRolePage() {
  const user = await requireUser();
  await enforceMfa(user);
  if (user.portals.length === 1) redirect(portalPath(user.portals[0]));
  if (user.portals.length === 0) redirect("/login?error=no_role");
  return (
    <AuthShell title={`Welcome, ${user.fullName.split(" ")[0]}`} description="Your account has access to more than one portal. Where would you like to go?">
      <div className="space-y-2.5">
        {user.portals.map((p) => {
          const Icon = ICONS[p];
          return (
            <form key={p} action={choosePortal.bind(null, p)}>
              <button className="group flex w-full items-center gap-4 rounded-md border border-line bg-white p-4 text-left transition-colors hover:border-line-strong">
                <span className="flex h-11 w-11 items-center justify-center rounded-sm bg-accent-50 text-accent"><Icon className="h-5 w-5" /></span>
                <span className="flex-1">
                  <span className="block font-medium">{PORTAL_LABELS[p]}</span>
                  <span className="block text-[13px] text-muted">{DESCRIPTIONS[p]}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-faint transition-transform group-hover:translate-x-0.5" />
              </button>
            </form>
          );
        })}
      </div>
    </AuthShell>
  );
}
