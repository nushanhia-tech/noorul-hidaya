import { createClient } from "@/lib/supabase/server";
import { requirePortal } from "@/lib/auth/session";
import { lookups, staffOptions } from "@/lib/data/lookups";
import { PageHeader } from "@/components/ui/misc";
import { NewFileForm } from "./form";

export const metadata = { title: "New file" };

export default async function NewFilePage({ searchParams }: { searchParams: Promise<{ student?: string }> }) {
  await requirePortal("office");
  const { student } = await searchParams;
  const [lk, staff] = await Promise.all([lookups(), staffOptions()]);
  let studentLabel: string | null = null;
  if (student) {
    const db = await createClient();
    const { data } = await db.from("students").select("register_no, profiles(full_name)").eq("id", student).maybeSingle();
    if (data) studentLabel = `${(data.profiles as unknown as { full_name: string }).full_name} (${data.register_no})`;
  }
  return (
    <>
      <PageHeader title="New office file" description="A unique reference number is generated automatically." back={{ href: "/portal/office/files", label: "Office files" }} />
      <NewFileForm sections={lk.sections.map((s) => ({ value: s.id, label: s.name }))} departments={lk.departments.map((d) => ({ value: d.id, label: d.name }))} staff={staff} studentId={student} studentLabel={studentLabel} />
    </>
  );
}
