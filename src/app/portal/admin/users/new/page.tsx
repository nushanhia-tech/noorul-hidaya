import { requirePortal } from "@/lib/auth/session";
import { lookups } from "@/lib/data/lookups";
import { PageHeader } from "@/components/ui/misc";
import { NewUserForm } from "./form";

export const metadata = { title: "New user" };

export default async function NewUserPage() {
  await requirePortal("admin");
  const lk = await lookups();
  return (
    <>
      <PageHeader title="New user" description="There is no public sign-up: every account is created here." back={{ href: "/portal/admin/users", label: "Users" }} />
      <NewUserForm lk={lk} />
    </>
  );
}
