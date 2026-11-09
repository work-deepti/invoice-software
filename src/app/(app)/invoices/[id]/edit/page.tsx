import type { Metadata } from "next";
import { EditInvoice } from "./edit-invoice";

export const metadata: Metadata = { title: "Edit invoice" };

export default function EditInvoicePage() {
  return <EditInvoice />;
}
