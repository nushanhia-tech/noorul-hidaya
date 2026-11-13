import { Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePortal } from "@/lib/auth/session";
import { PageHeader, EmptyState, Tabs } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { EditRow } from "../academic-forms";
import { MessageActions } from "./actions-client";

export const metadata = { title: "Contact Messages" };

export default async function ContactMessages({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requirePortal("admin");
  const { view } = await searchParams;
  const db = await createClient();
  let q = db.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(200);
  q = view === "archived" ? q.eq("status", "archived") : q.neq("status", "archived");
  const { data } = await q;
  return (
    <>
      <PageHeader title="Contact messages" description="Messages sent through the public contact form." />
      <Tabs active={view === "archived" ? "/portal/admin/messages?view=archived" : "/portal/admin/messages"} items={[{ href: "/portal/admin/messages", label: "Inbox" }, { href: "/portal/admin/messages?view=archived", label: "Archived" }]} />
      <Card>
        {(data ?? []).length === 0 ? <EmptyState icon={Inbox} title="No messages" /> : (data ?? []).map((m) => (
          <EditRow key={m.id} summary={<span className="flex flex-wrap items-center gap-2"><span className="font-medium">{m.subject}</span><StatusBadge status={m.status === "new" ? "new" : m.status} /><span className="text-xs text-muted">{m.name} · {formatDateTime(m.created_at)}</span></span>}>
            <p className="text-sm text-muted">{m.name} · <a className="text-royal underline" href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject)}`}>{m.email}</a>{m.phone && ` · ${m.phone}`}</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{m.message}</p>
            <MessageActions id={m.id} />
          </EditRow>
        ))}
      </Card>
    </>
  );
}
