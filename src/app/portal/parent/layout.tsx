import { requirePortal } from "@/lib/auth/session";
import { PortalShell } from "@/components/portal/shell";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requirePortal("parent");
  return <PortalShell user={user} portal="parent">{children}</PortalShell>;
}
