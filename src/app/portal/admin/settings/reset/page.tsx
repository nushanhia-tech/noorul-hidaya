import { redirect } from "next/navigation";
import { requirePortal } from "@/lib/auth/session";
import { PageHeader, Notice } from "@/components/ui/misc";
import { Card, CardBody } from "@/components/ui/card";
import { ResetForm } from "./form";

export const metadata = { title: "Full site reset" };

export default async function ResetPage() {
  const user = await requirePortal("admin");
  if (!user.roles.includes("admin")) redirect("/forbidden");
  return (
    <>
      <PageHeader title="Full site reset" back={{ href: "/portal/admin/settings", label: "Settings" }}
        description="Start again with an empty system — for example after testing with demo data." />
      <Notice tone="danger" title="This permanently deletes everything" className="mb-6 max-w-3xl">
        All students, teacher, parents and office staff accounts · departments, classes, subjects, timetables · marks and results ·
        fees, payments and receipts · office files, tasks, letters, help-desk tickets · website pages, news, events, gallery · every uploaded document and image.
        <br /><br /><strong>Kept:</strong> your own administrator account, and roles &amp; permissions. There is no undo — take a backup first (see docs/BACKUP_AND_RESTORE.md).
      </Notice>
      <Card className="max-w-3xl"><CardBody><ResetForm email={user.email} /></CardBody></Card>
    </>
  );
}
