import { createClient } from "@/lib/supabase/server";
import { requirePortal } from "@/lib/auth/session";
import { PageHeader, Notice } from "@/components/ui/misc";
import { Card, CardBody } from "@/components/ui/card";
import { can } from "@/lib/auth/session";
import { getSiteSettings } from "@/lib/data/site";
import { LetterForm } from "./form";

export const metadata = { title: "Register letter" };

export default async function NewLetter({ searchParams }: { searchParams: Promise<{ direction?: string; file?: string }> }) {
  const user = await requirePortal("office");
  if (!can(user, "letters.manage")) return <Notice tone="warning">Your role cannot register letters.</Notice>;
  const { direction = "outward", file } = await searchParams;
  const db = await createClient();
  const [{ data: depts }, { data: templates }, { data: files }, settings] = await Promise.all([
    db.from("departments").select("id, name").order("name"),
    db.from("letter_templates").select("id, name, subject, body").eq("is_active", true).order("name"),
    db.from("office_files").select("id, reference_no, subject").neq("status", "archived").order("created_at", { ascending: false }).limit(100),
    getSiteSettings(),
  ]);
  const inward = direction === "inward";
  return (
    <>
      <PageHeader title={inward ? "Register inward letter" : "New outward letter"} description="A register reference number is generated automatically." back={{ href: `/portal/office/correspondence?view=${inward ? "inward" : "outward"}`, label: "Correspondence" }} />
      <Card className="max-w-4xl"><CardBody>
        <LetterForm inward={inward} departments={(depts ?? []).map((d) => ({ value: d.id, label: d.name }))}
          files={(files ?? []).map((f) => ({ value: f.id, label: `${f.reference_no} — ${f.subject}` }))} defaultFile={file}
          templates={templates ?? []} vars={{ college_name: settings.college_name, college_address: settings.address ?? "", date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }), signatory: user.fullName }} />
      </CardBody></Card>
    </>
  );
}
