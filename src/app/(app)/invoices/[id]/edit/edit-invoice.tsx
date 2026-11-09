"use client";
import { useParams } from "next/navigation";
import { InvoiceWorkspace } from "@/components/invoice/workspace";

export function EditInvoice() {
  const { id } = useParams<{ id: string }>();
  return <InvoiceWorkspace key={id} editId={id} />;
}
