import { getMyStudent } from "@/lib/data/student";
import { FeesView } from "@/components/portal/fees-view";

export const metadata = { title: "Fees & Payments" };

export default async function StudentFees({ searchParams }: { searchParams: Promise<{ paid?: string; failed?: string }> }) {
  const sp = await searchParams;
  const { student } = await getMyStudent();
  return <FeesView studentId={student.id} canPay base="/portal/student/fees" flash={sp} />;
}
