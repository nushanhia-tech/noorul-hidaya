import { NotificationsPage } from "@/components/portal/notifications-page";

export const metadata = { title: "Notifications" };

export default function Page({ searchParams }: { searchParams: Promise<{ page?: string; filter?: string }> }) {
  return <NotificationsPage searchParams={searchParams} base="/portal/admin" />;
}
