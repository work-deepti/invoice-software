import type { Metadata } from "next";
import { ComingNext } from "@/components/shell/coming-next";

export const metadata: Metadata = { title: "Transactions" };

export default function TransactionsPage() {
  return (
    <ComingNext
      title="Transactions ledger"
      text="The searchable list of every invoice, with filters, totals, CSV export and backup, is the next build step. Saved invoices are already stored and can be opened from the invoice preview."
    />
  );
}
