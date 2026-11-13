import { createClient } from "@/lib/supabase/server";
import { getMyStudent } from "@/lib/data/student";
import { PageHeader, KeyValue, Avatar } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate, humanize } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { ProfileForm } from "./form";

export const metadata = { title: "My Profile" };

export default async function StudentProfile() {
  const { user, student } = await getMyStudent();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("phone, email").eq("id", user.id).single();
  return (
    <>
      <PageHeader title="My profile" description="Academic identifiers are maintained by the college office. Contact the office through the help desk to correct them." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card>
          <CardBody className="flex items-center gap-4 border-b border-line">
            <Avatar name={user.fullName} src={mediaUrl(user.avatarPath)} size={64} />
            <div>
              <p className="font-display text-xl font-semibold">{user.fullName}</p>
              <p className="text-sm text-muted">{profile?.email}</p>
            </div>
            <div className="ml-auto"><StatusBadge status={student.status} /></div>
          </CardBody>
          <CardBody>
            <KeyValue items={[
              { label: "Register number", value: <span className="tabular">{student.register_no}</span> },
              { label: "Admission number", value: student.admission_no },
              { label: "Programme", value: student.programmes?.name },
              { label: "Department", value: student.programmes?.departments?.name },
              { label: "Batch", value: student.batches?.name },
              { label: "Current semester", value: student.current_semester },
              { label: "Date of birth", value: formatDate(student.date_of_birth) },
              { label: "Gender", value: humanize(student.gender) },
              { label: "Guardian", value: student.guardian_name },
              { label: "Admitted on", value: formatDate(student.admitted_on) },
            ]} />
          </CardBody>
        </Card>
        <Card className="h-fit">
          <CardHeader title="Contact details" description="You can update these yourself." />
          <CardBody>
            <ProfileForm phone={profile?.phone ?? ""} address={student.address ?? ""} guardianPhone={student.guardian_phone ?? ""} emergency={student.emergency_contact ?? ""} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
