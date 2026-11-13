import { pickStudent } from "@/lib/data/parent";
import { PageHeader } from "@/components/ui/misc";
import { FeesView } from "@/components/portal/fees-view";
import { StudentSwitcher, NoLinkedStudent } from "@/components/portal/student-switcher";

export const metadata = { title: "Fee Information" };

export default async function ParentFees({ searchParams }: { searchParams: Promise<{ student?: string }> }) {
  const { students, current, pending } = await pickStudent((await searchParams).student);
  if (!current) return <><PageHeader title="Fee information" /><NoLinkedStudent pending={pending} /></>;
  return (
    <>
      <StudentSwitcher students={students} current={current} base="/portal/parent/fees" />
      <FeesView studentId={current.student_id} canPay={false} base="/portal/parent/fees" />
    </>
  );
}
