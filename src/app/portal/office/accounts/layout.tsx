import { requirePortal, can } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { AccountsNav } from "./nav";

export default async function AccountsLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortal("office");
  if (!can(user, "finance.view")) redirect("/forbidden");
  return (<><AccountsNav />{children}</>);
}
