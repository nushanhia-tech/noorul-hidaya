import { cn } from "@/lib/utils";

/**
 * Responsive data table: a real <table> on tablet/desktop and a stacked card
 * list on phones (no cramped horizontal scrolling).
 */
export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
  align?: "left" | "right";
  /** hide this column in the mobile card */
  mobileHidden?: boolean;
  /** render as the mobile card title */
  primary?: boolean;
};

export function DataTable<T>({
  rows, columns, rowKey, empty, rowHref, className,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  empty?: React.ReactNode;
  rowHref?: (row: T) => string;
  className?: string;
}) {
  if (!rows.length) return <>{empty}</>;
  const primary = columns.find((c) => c.primary) ?? columns[0];
  return (
    <div className={className}>
      <div className="hidden md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line">
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn("px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-faint first:pl-5 last:pr-5", c.align === "right" && "text-right", c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)} className="group relative border-b border-line/70 last:border-0 hover:bg-white/70">
                {columns.map((c, i) => (
                  <td key={c.key} className={cn("px-4 py-3 align-middle text-ink-soft first:pl-5 last:pr-5", c.align === "right" && "text-right tabular", c.className)}>
                    {i === 0 && rowHref ? (
                      <a href={rowHref(r)} className="font-medium text-ink after:absolute after:inset-0 hover:underline">{c.cell(r)}</a>
                    ) : c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-line md:hidden">
        {rows.map((r) => {
          const inner = (
            <>
              <div className="text-[15px] font-medium text-ink">{primary.cell(r)}</div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
                {columns.filter((c) => c !== primary && !c.mobileHidden).map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className="text-[11px] uppercase tracking-wide text-faint">{c.header}</dt>
                    <dd className="mt-0.5 truncate text-[13px] text-ink-soft">{c.cell(r)}</dd>
                  </div>
                ))}
              </dl>
            </>
          );
          return (
            <li key={rowKey(r)}>
              {rowHref ? <a href={rowHref(r)} className="block px-4 py-3.5 active:bg-white">{inner}</a> : <div className="px-4 py-3.5">{inner}</div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
