"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  ["Dashboard", "/portal/office/accounts"], ["Fee structures", "/portal/office/accounts/structures"], ["Student ledgers", "/portal/office/accounts/ledgers"],
  ["Collect fees", "/portal/office/accounts/collect"], ["Payments", "/portal/office/accounts/payments"], ["Receipts", "/portal/office/accounts/receipts"],
  ["Outstanding", "/portal/office/accounts/outstanding"], ["Concessions", "/portal/office/accounts/concessions"], ["Refunds", "/portal/office/accounts/refunds"],
  ["Reconciliation", "/portal/office/accounts/reconciliation"], ["Reports", "/portal/office/accounts/reports"],
];

export function AccountsNav() {
  const path = usePathname();
  return (
    <nav aria-label="Accounts" className="scrollbar-none -mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
      {ITEMS.map(([label, href]) => {
        const active = href === "/portal/office/accounts" ? path === href : path.startsWith(href);
        return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm", active ? "border-accent font-medium text-ink" : "border-transparent text-muted hover:text-ink")}>{label}</Link>;
      })}
    </nav>
  );
}
