import { requireUser, getActivePortal, enforceMfa } from "@/lib/auth/session";
import { PortalShell } from "@/components/portal/shell";
import { redirect } from "next/navigation";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  await enforceMfa(user, { allowSetup: true });
  const portal = await getActivePortal(user);
  if (!portal) redirect("/login?error=no_role");
  return <PortalShell user={user} portal={portal}>{children}</PortalShell>;
}
