"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/misc";
import { validateMark } from "@/lib/grades";
import { cn } from "@/lib/utils";
import { saveMarks } from "../../actions";

type Row = { id: string; registerNo: string; name: string; value: string };

export function MarksGrid({ examId, offeringId, max, students, editable }: { examId: string; offeringId: string; max: number; students: Row[]; editable: boolean }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(students.map((s) => [s.id, s.value])));
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    for (const s of students) { const v = validateMark(values[s.id] ?? "", max); if (v.error) e[s.id] = v.error; }
    return e;
  }, [values, students, max]);
  const filled = students.filter((s) => (values[s.id] ?? "").trim() !== "").length;
  const stats = useMemo(() => {
    const nums = students.map((s) => validateMark(values[s.id] ?? "", max)).filter((v) => v.marks !== null).map((v) => v.marks!);
    return nums.length ? { avg: (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1), hi: Math.max(...nums), lo: Math.min(...nums) } : null;
  }, [values, students, max]);

  const run = (submit: boolean) => start(async () => {
    setMsg(null);
    const res = await saveMarks(examId, offeringId, students.map((s) => ({ studentId: s.id, value: values[s.id] ?? "" })), submit);
    if (res.ok) { setMsg({ ok: true, text: res.message ?? "Saved" }); setDirty(false); setServerErrors({}); router.refresh(); }
    else { setMsg({ ok: false, text: res.error }); setServerErrors(res.fieldErrors ?? {}); }
  });

  if (!students.length) return <Notice tone="warning">No students are enrolled in this course offering.</Notice>;

  return (
    <div className="space-y-4">
      {msg && <Notice tone={msg.ok ? "success" : "danger"}>{msg.text}</Notice>}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-muted">
        <span><span className="tabular font-medium text-ink">{filled}</span> of {students.length} entered</span>
        {stats && <span>Average <span className="tabular font-medium text-ink">{stats.avg}</span> · High {stats.hi} · Low {stats.lo}</span>}
        <span>Type <kbd className="rounded-xs bg-sand px-1">AB</kbd> for absent</span>
      </div>
      <div className="overflow-hidden rounded-md border border-line bg-paper">
        <ol className="divide-y divide-line">
          {students.map((s, i) => {
            const err = errors[s.id] ?? serverErrors[s.id];
            return (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                <span className="tabular hidden w-8 text-xs text-faint sm:block">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{s.name}</span>
                  <span className="tabular text-xs text-muted">{s.registerNo}</span>
                </span>
                <span className="w-28 shrink-0 text-right">
                  <input
                    aria-label={`Marks for ${s.name}`} disabled={!editable || pending} inputMode="decimal"
                    value={values[s.id] ?? ""} placeholder={`/ ${max}`}
                    onChange={(e) => { setValues((v) => ({ ...v, [s.id]: e.target.value })); setDirty(true); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.currentTarget.closest("li")?.nextElementSibling?.querySelector("input") as HTMLInputElement | null)?.focus(); } }}
                    className={cn("tabular h-10 w-full rounded-sm border bg-white px-3 text-right text-[15px] focus:outline-none focus:ring-2 disabled:bg-sand",
                      err ? "border-danger focus:ring-danger/20" : "border-line-strong focus:border-royal focus:ring-royal/15")}
                    aria-invalid={!!err}
                  />
                  {err && <span className="mt-0.5 block text-[11px] text-danger">{err}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      {editable && (
        <div className="sticky bottom-20 z-10 flex flex-col gap-2 rounded-md border border-line bg-paper/95 p-3 shadow-pop backdrop-blur sm:flex-row sm:items-center sm:justify-between lg:bottom-4">
          <p className="text-[13px] text-muted">{dirty ? "Unsaved changes" : "All changes saved"}</p>
          <div className="flex gap-2">
            <Button variant="outline" disabled={pending || Object.keys(errors).length > 0} onClick={() => run(false)}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save draft
            </Button>
            <Button disabled={pending || Object.keys(errors).length > 0 || filled < students.length} onClick={() => {
              if (confirm("Submit marks? The sheet will be locked and sent for result publication.")) run(true);
            }}>
              <Send className="h-4 w-4" /> Submit marks
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
