import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyStudent } from "@/lib/data/student";
import { providerStatus } from "@/lib/payments/provider";
import { PageHeader, KeyValue, Notice } from "@/components/ui/misc";
import { Card, CardBody } from "@/components/ui/card";
import { formatMoney } from "@/lib/fees";
import { formatDate } from "@/lib/format";
import { PayPanel } from "./pay-panel";

export const metadata = { title: "Pay fees" };

export default async function PayPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const { student } = await getMyStudent();
  const supabase = await createClient();
  const { data: inv } = await supabase.from("invoice_balances").select("*").eq("invoice_id", invoiceId).eq("student_id", student.id).maybeSingle();
  if (!inv) notFound();
  const status = providerStatus();
  return (
    <>
      <PageHeader title="Pay online" back={{ href: "/portal/student/fees", label: "Fees & payments" }} />
      <div className="grid max-w-4xl gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardBody>
            <KeyValue columns={1} items={[
              { label: "Fee", value: inv.title },
              { label: "Invoice", value: <span className="tabular">{inv.invoice_no}</span> },
              { label: "Due date", value: formatDate(inv.due_date) },
              { label: "Outstanding", value: <span className="font-display text-2xl font-semibold">{formatMoney(inv.outstanding)}</span> },
            ]} />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            {!status.configured ? <Notice tone="warning" title="Online payment unavailable">{status.reason} Please pay at the accounts office.</Notice>
              : Number(inv.outstanding) <= 0 ? <Notice tone="success">This fee is fully paid.</Notice>
              : <PayPanel invoiceId={inv.invoice_id} outstanding={Number(inv.outstanding)} sandbox={status.mode === "sandbox"} />}
          </CardBody>
        </Card>
      </div>
      <p className="mt-6 max-w-4xl text-xs leading-relaxed text-muted">
        Card and bank details are entered only on the payment provider&rsquo;s secure page and are never stored by the college. A receipt is issued only after the provider confirms the payment.
      </p>
    </>
  );
}
