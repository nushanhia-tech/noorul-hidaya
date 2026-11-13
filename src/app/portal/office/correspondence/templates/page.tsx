import { createClient } from "@/lib/supabase/server";
import { requirePortal, can } from "@/lib/auth/session";
import { PageHeader, EmptyState, Notice } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EditRow } from "@/app/portal/admin/academic-forms";
import { TemplateForm } from "./form";

export const metadata = { title: "Letter Templates" };

export default async function TemplatesPage() {
  const user = await requirePortal("office");
  const db = await createClient();
  const { data } = await db.from("letter_templates").select("*").order("name");
  const manage = can(user, "letters.manage");
  return (
    <>
      <PageHeader title="Letter templates" back={{ href: "/portal/office/correspondence?view=outward", label: "Correspondence" }}
        description="Reusable letter text. Available placeholders: {{college_name}}, {{college_address}}, {{date}}, {{recipient_name}}, {{signatory}}." />
      <Notice tone="info" className="mb-6">Templates help draft routine correspondence. Official certificates are not generated here — they are prepared and signed manually by the office.</Notice>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          {(data ?? []).length === 0 ? <EmptyState title="No templates yet" /> : (data ?? []).map((t) => (
            <EditRow key={t.id} summary={<span className="flex items-center gap-2"><span className="font-medium">{t.name}</span>{!t.is_active && <Badge>Inactive</Badge>}</span>}>
              {manage ? <TemplateForm t={t} /> : <p className="whitespace-pre-wrap text-sm">{t.body}</p>}
            </EditRow>
          ))}
        </Card>
        {manage && <Card className="h-fit"><CardHeader title="New template" /><CardBody><TemplateForm /></CardBody></Card>}
      </div>
    </>
  );
}
