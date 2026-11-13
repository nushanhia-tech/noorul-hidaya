import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { EditRow } from "@/app/portal/admin/academic-forms";
import { formatDate, humanize } from "@/lib/format";
import { NoticeForm } from "./manager";

export async function ManageNotices() {
  const db = await createClient();
  const { data } = await db.from("notices").select("*").order("created_at", { ascending: false }).limit(200);
  return (
    <>
      <PageHeader title="Notices & announcements" description="Publishing a notice notifies every user in its audience. 'Public' notices also appear on the website." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          {(data ?? []).length === 0 ? <EmptyState title="No notices yet" /> : (data ?? []).map((n) => (
            <EditRow key={n.id} summary={
              <span className="flex flex-wrap items-center gap-2"><span className="font-medium">{n.title}</span><StatusBadge status={n.status} />{n.is_important && <Badge tone="accent">Important</Badge>}
                <span className="text-xs text-muted">{humanize(n.category)} · {(n.audience as string[]).join(", ")} · {formatDate(n.published_at ?? n.created_at)}</span></span>
            }>
              <NoticeForm n={n} />
            </EditRow>
          ))}
        </Card>
        <Card className="h-fit"><CardHeader title="New notice" /><CardBody><NoticeForm /></CardBody></Card>
      </div>
    </>
  );
}
