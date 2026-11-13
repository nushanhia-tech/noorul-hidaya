import { requirePortal } from "@/lib/auth/session";
import { ManageNotices } from "@/components/notices/manage-page";

export const metadata = { title: "Notices" };

export default async function AdminNotices() {
  await requirePortal("admin");
  return <ManageNotices />;
}
