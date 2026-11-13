import { LibraryBig } from "lucide-react";
import { getMyFaculty, getMyOfferings } from "@/lib/data/faculty";
import { PageHeader, EmptyState, Tabs } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "My Courses" };

export default async function MyCourses({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const { all } = await searchParams;
  const { faculty } = await getMyFaculty();
  const offerings = await getMyOfferings(faculty.id, !all);
  return (
    <>
      <PageHeader title="My courses" description="Courses you are assigned to teach." />
      <Tabs active={all ? "/portal/faculty/courses?all=1" : "/portal/faculty/courses"} items={[{ href: "/portal/faculty/courses", label: "Current term" }, { href: "/portal/faculty/courses?all=1", label: "All terms" }]} />
      <Card>
        <DataTable rows={offerings} rowKey={(o) => o.id} rowHref={(o) => `/portal/faculty/courses/${o.id}`}
          empty={<EmptyState icon={LibraryBig} title="No courses assigned" description="Course assignments are made by the academic administrator." />}
          columns={[
            { key: "course", header: "Course", primary: true, cell: (o) => <span><span className="tabular mr-2 text-faint">{o.courses?.code}</span>{o.courses?.title}</span> },
            { key: "batch", header: "Batch", cell: (o) => o.batches?.name },
            { key: "sem", header: "Semester", cell: (o) => o.semester_number },
            { key: "term", header: "Term", cell: (o) => <span className="flex items-center gap-1.5">{o.terms?.name}{o.terms?.is_current && <Badge tone="teal">Current</Badge>}</span> },
            { key: "students", header: "Students", align: "right", cell: (o) => o.enrolments?.[0]?.count ?? 0 },
            { key: "credits", header: "Credits", align: "right", cell: (o) => Number(o.courses?.credits) },
          ]} />
      </Card>
    </>
  );
}
