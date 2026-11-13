import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePortal } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody } from "@/components/ui/card";
import { Thread, type ThreadMessage } from "@/components/portal/thread";
import { OfficeParentReply, ThreadToggle } from "./forms";

export const metadata = { title: "Parent conversation" };

export default async function ParentThreadOffice({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePortal("office");
  const { id } = await params;
  const db = await createClient();
  const { data: t } = await db.from("parent_threads").select("id, subject, status, parent_id, parent:profiles!parent_threads_parent_id_fkey(full_name), students(register_no, profiles(full_name))").eq("id", id).maybeSingle();
  if (!t) notFound();
  const { data: msgs } = await db.from("parent_messages").select("id, body, created_at, author_id, author:profiles!parent_messages_author_id_fkey(full_name)").eq("thread_id", id).order("created_at");
  const s = t.students as unknown as { register_no: string; profiles: { full_name: string } };
  return (
    <>
      <PageHeader title={t.subject} description={`${(t.parent as unknown as { full_name: string }).full_name} · about ${s.profiles.full_name} (${s.register_no})`} back={{ href: "/portal/office/parents", label: "Parent messages" }} actions={<ThreadToggle id={id} status={t.status} />} />
      <Card className="max-w-3xl">
        <CardBody><Thread messages={(msgs ?? []) as unknown as ThreadMessage[]} me={user.id} requesterId={t.parent_id} /></CardBody>
        {t.status === "open" && <CardBody className="border-t border-line"><OfficeParentReply id={id} /></CardBody>}
      </Card>
    </>
  );
}
