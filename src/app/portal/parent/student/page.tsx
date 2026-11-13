import { pickStudent } from "@/lib/data/parent";
import { PageHeader, KeyValue } from "@/components/ui/misc";
import { Card, CardBody } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { StudentSwitcher, NoLinkedStudent } from "@/components/portal/student-switcher";
import { humanize } from "@/lib/format";

export const metadata = { title: "Student Profile" };

export default async function LinkedStudentPage({ searchParams }: { searchParams: Promise<{ student?: string }> }) {
  const { students, current, pending } = await pickStudent((await searchParams).student);
  return (
    <>
      <PageHeader title="Student profile" description="Basic academic information shared with linked parents." />
      {!current ? <NoLinkedStudent pending={pending} /> : (
        <>
          <StudentSwitcher students={students} current={current} base="/portal/parent/student" />
          <Card className="max-w-3xl">
            <CardBody className="flex items-center justify-between border-b border-line">
              <div><p className="font-display text-xl font-semibold">{current.full_name}</p><p className="text-sm text-muted">Your relationship: {humanize(current.relationship)}</p></div>
              <StatusBadge status={current.status} />
            </CardBody>
            <CardBody>
              <KeyValue items={[
                { label: "Register number", value: current.register_no }, { label: "Programme", value: current.programme },
                { label: "Department", value: current.department }, { label: "Batch", value: current.batch },
                { label: "Current semester", value: current.current_semester },
              ]} />
            </CardBody>
          </Card>
        </>
      )}
    </>
  );
}
