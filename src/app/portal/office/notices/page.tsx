import { requirePortal, can } from "@/lib/auth/session";
import { NoticesPage } from "@/components/portal/notices-page";
import { ManageNotices } from "@/components/notices/manage-page";

export const metadata = { title: "Notices" };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const user = await requirePortal("office");
  return can(user, "notices.publish") ? <ManageNotices /> : <NoticesPage searchParams={searchParams} />;
}
