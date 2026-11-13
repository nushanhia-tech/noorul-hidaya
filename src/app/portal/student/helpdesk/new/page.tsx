import { PageHeader, Notice } from "@/components/ui/misc";
import { Card, CardBody } from "@/components/ui/card";
import { getMyStudent } from "@/lib/data/student";
import { NewTicketForm } from "./form";

export const metadata = { title: "New request" };

export default async function NewTicketPage() {
  await getMyStudent();
  return (
    <>
      <PageHeader title="New help desk request" back={{ href: "/portal/student/helpdesk", label: "Help desk" }} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card><CardBody><NewTicketForm /></CardBody></Card>
        <Notice tone="info" title="About certificate requests" className="h-fit">
          Certificates (bonafide, conduct, transfer, course completion) are prepared and signed manually by the college office. Raise a request here and staff will tell you when it is ready to collect, or what else is needed.
        </Notice>
      </div>
    </>
  );
}
