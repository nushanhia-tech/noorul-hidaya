import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LinkedStudent } from "@/lib/data/parent";
import { EmptyState } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { UserX } from "lucide-react";

export function StudentSwitcher({ students, current, base }: { students: LinkedStudent[]; current: LinkedStudent; base: string }) {
  if (students.length < 2) return null;
  return (
    <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Linked students">
      {students.map((s) => (
        <Link key={s.student_id} href={`${base}?student=${s.student_id}`} role="tab" aria-selected={s.student_id === current.student_id}
          className={cn("rounded-sm border px-3 py-1.5 text-sm", s.student_id === current.student_id ? "border-ink bg-ink text-white" : "border-line bg-paper hover:bg-white")}>
          {s.full_name}
        </Link>
      ))}
    </div>
  );
}

export function NoLinkedStudent({ pending }: { pending: number }) {
  return (
    <Card>
      <EmptyState icon={UserX} title={pending ? "Your link to a student is awaiting verification" : "No student is linked to your account"}
        description="The school office verifies parent–student links (and, for adult students, records the student's consent) before any information is shared." />
    </Card>
  );
}
