import { Download, FileDown } from "lucide-react";
import { requirePortal, can } from "@/lib/auth/session";
import { buildOfficeReport, type ReportKind } from "@/lib/reports/office";
import { PageHeader, StatCard, Tabs, Notice } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { SimpleBarChart } from "@/components/charts";
import { todayISO } from "@/lib/format";

export const metadata = { title: "Reports & Analytics" };

const TABS: { k: ReportKind; label: string; csv?: string }[] = [
  { k: "overview", label: "Analytics dashboard" }, { k: "financial", label: "Financial", csv: "payments" }, { k: "files", label: "Files", csv: "files" },
  { k: "tasks", label: "Tasks", csv: "tasks" }, { k: "correspondence", label: "Correspondence", csv: "letters" }, { k: "helpdesk", label: "Help desk", csv: "tickets" },
];

export default async function OfficeReports({ searchParams }: { searchParams: Promise<{ tab?: string; from?: string; to?: string }> }) {
  const user = await requirePortal("office");
  const sp = await searchParams;
  const allowed = TABS.filter((t) => (t.k === "financial" ? can(user, "finance.view") : can(user, ["office.reports", "files.view_all"])));
  if (!allowed.length) return <Notice tone="warning">Your role does not include office reports.</Notice>;
  const tab = allowed.find((t) => t.k === sp.tab) ?? allowed[0];
  const from = sp.from || `${todayISO().slice(0, 4)}-01-01`;
  const to = sp.to || todayISO();
  const r = await buildOfficeReport(tab.k, from, to);
  const q = `from=${from}&to=${to}`;
  return (
    <>
      <PageHeader title="Reports & analytics" description="Calculated from live office records for the selected period."
        actions={<>
          {tab.csv && <a href={`/api/export/${tab.csv}?${q}`} className="inline-flex h-10 items-center gap-1.5 rounded-sm border border-line-strong bg-paper px-3 text-sm hover:bg-white"><Download className="h-4 w-4" /> CSV</a>}
          <a href={`/api/reports/office?type=${tab.k}&${q}`} className="inline-flex h-10 items-center gap-1.5 rounded-sm bg-ink px-3 text-sm text-white"><FileDown className="h-4 w-4" /> PDF</a>
        </>} />
      <Tabs active={`/portal/office/reports?tab=${tab.k}`} items={allowed.map((t) => ({ href: `/portal/office/reports?tab=${t.k}`, label: t.label }))} />
      <form className="mb-6 flex flex-wrap items-end gap-2">
        <input type="hidden" name="tab" value={tab.k} />
        <label className="text-sm">From <input type="date" name="from" defaultValue={from} className="ml-1 h-10 rounded-sm border border-line-strong bg-white px-3" /></label>
        <label className="text-sm">To <input type="date" name="to" defaultValue={to} className="ml-1 h-10 rounded-sm border border-line-strong bg-white px-3" /></label>
        <button className="h-10 rounded-sm bg-ink px-4 text-sm text-white">Apply</button>
      </form>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{r.stats.map((s) => <StatCard key={s.label} label={s.label} value={s.value} />)}</div>
      {r.chart && (
        <Card className="mb-6">
          <CardHeader title={r.chart.title} />
          <CardBody>
            {r.chart.data.some((d) => Number(d[r.chart!.y]) > 0) ? <SimpleBarChart data={r.chart.data} x={r.chart.x} y={r.chart.y} name={r.chart.y} format={r.chart.money ? "money" : "number"} height={280} />
              : <p className="py-10 text-center text-sm text-muted">No records in this period.</p>}
          </CardBody>
        </Card>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        {r.tables.map((t) => (
          <Card key={t.title}>
            <CardHeader title={t.title} />
            <DataTable rows={t.rows.map((row, i) => ({ i, row }))} rowKey={(x) => String(x.i)} empty={<p className="px-5 py-6 text-sm text-muted">No data.</p>}
              columns={t.headers.map((h, j) => ({ key: String(j), header: h, primary: j === 0, align: t.align?.[j], cell: (x: { row: (string | number)[] }) => x.row[j] }))} />
          </Card>
        ))}
      </div>
    </>
  );
}
