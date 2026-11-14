import { getMyFaculty, getMyOfferings, offeringLabel } from "@/lib/data/faculty";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, KeyValue, Avatar } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { FacultyProfileForm } from "./form";

export const metadata = { title: "Teacher Profile" };

export default async function FacultyProfile() {
  const { user, faculty } = await getMyFaculty();
  const offerings = await getMyOfferings(faculty.id);
  const supabase = await createClient();
  const { data: p } = await supabase.from("profiles").select("email, phone").eq("id", user.id).single();
  return (
    <>
      <PageHeader title="Teacher profile" description="Your public directory entry uses your qualification, specialisation and bio." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardBody className="flex items-center gap-4 border-b border-line">
              <Avatar name={user.fullName} src={mediaUrl(user.avatarPath)} size={64} />
              <div><p className="font-display text-xl font-semibold">{user.fullName}</p><p className="text-sm text-muted">{faculty.designation}</p></div>
            </CardBody>
            <CardBody>
              <KeyValue items={[
                { label: "Employee number", value: faculty.employee_no }, { label: "Department", value: faculty.departments?.name },
                { label: "Email", value: p?.email }, { label: "Phone", value: p?.phone },
                { label: "Joined", value: formatDate(faculty.joined_on) }, { label: "Head of department", value: faculty.is_hod ? "Yes" : "No" },
              ]} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Assigned subjects" description="Current term" />
            <ul className="divide-y divide-line">
              {offerings.map((o) => <li key={o.id} className="px-5 py-3 text-sm"><span className="font-medium">{offeringLabel(o)}</span><span className="block text-xs text-muted">{o.batches?.name}</span></li>)}
              {!offerings.length && <li className="px-5 py-4 text-sm text-muted">None assigned.</li>}
            </ul>
          </Card>
        </div>
        <Card className="h-fit">
          <CardHeader title="Directory details" />
          <CardBody><FacultyProfileForm qualification={faculty.qualification} specialization={faculty.specialization} bio={faculty.bio} /></CardBody>
        </Card>
      </div>
    </>
  );
}
