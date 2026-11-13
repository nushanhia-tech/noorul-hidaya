"use client";
import { Fragment } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { saveMatrix } from "./actions";

type P = { key: string; module: string; description: string };

export function MatrixForm({ roles, permissions, granted, editable }: { roles: { key: string; label: string }[]; permissions: P[]; granted: string[]; editable: boolean }) {
  const set = new Set(granted);
  const modules = Array.from(new Set(permissions.map((p) => p.module)));
  return (
    <ActionForm action={saveMatrix} className="space-y-4">
      {/* keep grants for roles not shown (student/parent/faculty) */}
      {granted.filter((g) => !roles.some((r) => g.startsWith(r.key + "|"))).map((g) => <input key={g} type="hidden" name="grant" value={g} />)}
      <div className="overflow-x-auto rounded-md border border-line bg-paper">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="sticky top-0 bg-paper">
            <tr className="border-b border-line">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-faint">Permission</th>
              {roles.map((r) => <th key={r.key} className="px-2 py-3 text-center text-xs font-medium text-ink-soft">{r.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {modules.map((m) => (
              <Fragment key={m}>
                <tr className="bg-ivory"><td colSpan={roles.length + 1} className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted">{m}</td></tr>
                {permissions.filter((p) => p.module === m).map((p) => (
                  <tr key={p.key} className="border-b border-line/70">
                    <td className="px-4 py-2.5"><span className="font-mono text-[12px] text-ink">{p.key}</span><span className="block text-xs text-muted">{p.description}</span></td>
                    {roles.map((r) => (
                      <td key={r.key} className="text-center">
                        <input type="checkbox" name="grant" value={`${r.key}|${p.key}`} defaultChecked={set.has(`${r.key}|${p.key}`)} disabled={!editable}
                          aria-label={`${r.label}: ${p.key}`} className="h-4 w-4 accent-[var(--color-accent)]" />
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {editable && <SubmitButton>Save permissions</SubmitButton>}
    </ActionForm>
  );
}
