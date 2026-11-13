import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLinkedStudents } from "@/lib/data/parent";
import { PageHeader, Notice } from "@/components/ui/misc";
import { Card, CardBody } from "@/components/ui/card";
import { Thread, type ThreadMessage } from "@/components/portal/thread";
import { ParentReply } from "../form";

export const metadata = { title: "Conversation" };

export default async function ParentThread({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, students } = await getLinkedStudents();
  const supabase = await createClient();
  const { data: t } = await supabase.from("parent_threads").select("id, subject, status, student_id, parent_id").eq("id", id).maybeSingle();
  if (!t || t.parent_id !== user.id) notFound();
  const { data: msgs } = await supabase.from("parent_messages").select("id, body, created_at, author_id, author:profiles!parent_messages_author_id_fkey(full_name)").eq("thread_id", id).order("created_at");
  return (
    <>
      <PageHeader title={t.subject} description={`About ${students.find((s) => s.student_id === t.student_id)?.full_name ?? "your ward"}`} back={{ href: "/portal/parent/messages", label: "Messages" }} />
      <Card className="max-w-3xl">
        <CardBody><Thread messages={(msgs ?? []) as unknown as ThreadMessage[]} me={user.id} requesterId={user.id} /></CardBody>
        <CardBody className="border-t border-line">{t.status === "open" ? <ParentReply id={t.id} /> : <Notice>This conversation has been closed by the office.</Notice>}</CardBody>
      </Card>
    </>
  );
}
