import Link from "next/link";
import { LifeBuoy, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMyStudent } from "@/lib/data/student";
import { PageHeader, EmptyState, Tabs } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { TICKET_CATEGORIES, TICKET_STATUS_LABELS, type TicketCategory } from "@/lib/constants";
import { formatDate, relativeTime } from "@/lib/format";

export const metadata = { title: "Help Desk" };

export default async function StudentHelpdesk({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { user } = await getMyStudent();
  const { view = "active" } = await searchParams;
  const supabase = await createClient();
  let q = supabase.from("tickets").select("id, ticket_no, subject, category, status, created_at, updated_at").eq("requester_id", user.id).order("updated_at", { ascending: false });
  q = view === "history" ? q.in("status", ["resolved", "closed"]) : q.not("status", "in", "(resolved,closed)");
  const { data } = await q;
  return (
    <>
      <PageHeader title="Help desk" description="Requests to the school office — certificates, receipts, record corrections and more."
        actions={<LinkButton href="/portal/student/helpdesk/new"><Plus className="h-4 w-4" /> New request</LinkButton>} />
      <Tabs active={`/portal/student/helpdesk${view === "history" ? "?view=history" : ""}`} items={[
        { href: "/portal/student/helpdesk", label: "Active" },
        { href: "/portal/student/helpdesk?view=history", label: "Resolved & closed" },
      ]} />
      <Card>
        <DataTable
          rows={data ?? []}
          rowKey={(r) => r.id}
          rowHref={(r) => `/portal/student/helpdesk/${r.id}`}
          empty={<EmptyState icon={LifeBuoy} title={view === "history" ? "No past requests" : "No active requests"} action={<Link href="/portal/student/helpdesk/new" className="text-sm font-medium text-royal hover:underline">Raise a request</Link>} />}
          columns={[
            { key: "subject", header: "Subject", primary: true, cell: (r) => r.subject },
            { key: "no", header: "Ticket", cell: (r) => <span className="tabular">{r.ticket_no}</span> },
            { key: "cat", header: "Category", cell: (r) => TICKET_CATEGORIES[r.category as TicketCategory] },
            { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} label={TICKET_STATUS_LABELS[r.status]} /> },
            { key: "opened", header: "Opened", cell: (r) => formatDate(r.created_at), mobileHidden: true },
            { key: "updated", header: "Updated", cell: (r) => relativeTime(r.updated_at) },
          ]}
        />
      </Card>
    </>
  );
}
