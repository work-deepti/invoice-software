import type { Metadata } from "next";
import { Ledger } from "./ledger";

export const metadata: Metadata = { title: "Transactions" };

export default function TransactionsPage() {
  return <Ledger />;
}
