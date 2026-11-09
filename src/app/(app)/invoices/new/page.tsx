import type { Metadata } from "next";
import { InvoiceWorkspace } from "@/components/invoice/workspace";

export const metadata: Metadata = { title: "New invoice" };

export default function NewInvoicePage() {
  return <InvoiceWorkspace />;
}
