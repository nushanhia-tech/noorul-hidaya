import { NoticesPage } from "@/components/portal/notices-page";

export const metadata = { title: "Notices" };

export default function Page({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  return <NoticesPage searchParams={searchParams} />;
}
