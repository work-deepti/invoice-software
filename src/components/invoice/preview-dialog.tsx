"use client";
import { Dialog as D } from "radix-ui";
import { Ban, Download, Pencil, Printer, X } from "lucide-react";
import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { formatINR, pdfFileName, toDec } from "@/lib/calc-engine";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InvoiceDocument } from "./invoice-document";
import { usePrint } from "./print";
import type { SavedInvoice } from "./types";

const A4_WIDTH = 794;

/** TXN-08: invoice preview scaled to fit, with Print, Download PDF, Edit, Cancel and Close. */
export function InvoicePreviewDialog({
  invoice,
  open,
  onOpenChange,
  onCancelInvoice,
}: {
  invoice: SavedInvoice | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCancelInvoice?: (inv: SavedInvoice) => void;
}) {
  const print = usePrint();
  const [duplicate, setDuplicate] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, height: 0 });

  useLayoutEffect(() => {
    if (!open) return;
    const box = boxRef.current;
    const doc = docRef.current;
    if (!box || !doc) return;
    const measure = () => {
      const scale = Math.min(1, (box.clientWidth - 2) / A4_WIDTH);
      setFit({ scale, height: doc.offsetHeight * scale });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    ro.observe(doc);
    return () => ro.disconnect();
  }, [open, invoice]);

  if (!invoice) return null;
  const grand = toDec(invoice.grandTotal);

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-[2px] data-[state=open]:animate-overlay" />
        <D.Content className="fixed inset-0 z-50 flex flex-col bg-sunken outline-none data-[state=open]:animate-enter tab:inset-4 tab:rounded-2xl tab:border tab:border-line tab:shadow-pop desk:inset-x-[max(16px,calc((100vw-920px)/2))]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line bg-surface px-4 py-3 tab:rounded-t-2xl tab:px-5">
            <div className="min-w-0 flex-1">
              <D.Title className="tight flex items-center gap-2 text-[15px] font-semibold text-ink">
                <span className="num">{invoice.number}</span>
                {invoice.status === "cancelled" ? (
                  <span className="rounded-full bg-danger-fill px-2 py-0.5 text-[11.5px] font-medium text-danger-deep">Cancelled</span>
                ) : null}
              </D.Title>
              <D.Description className="truncate text-[12.5px] text-muted">
                {invoice.customerName || "Cash customer"} · <span className="num">{formatINR(grand.abs())}</span>
                {invoice.createdByName ? <> · Created by {invoice.createdByName}</> : null}
                {invoice.updatedByName && invoice.updatedAt !== invoice.createdAt ? <> · Last edited by {invoice.updatedByName}</> : null}
              </D.Description>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Checkbox checked={duplicate} onCheckedChange={setDuplicate} label="Duplicate copy" className="mr-1 hidden tab:flex" />
              <Button variant="primary" size="sm" onClick={() => print(invoice, { duplicate })}>
                <Printer className="size-4" aria-hidden />
                Print
              </Button>
              <a
                href={`/api/invoices/${invoice.id}/pdf${duplicate ? "?copy=duplicate" : ""}`}
                download={pdfFileName(invoice.number)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-sunken px-3.5 text-[13px] font-semibold text-ink transition-colors hover:bg-line"
              >
                <Download className="size-4" aria-hidden />
                PDF
              </a>
              {invoice.permissions.canEdit ? (
                <Link
                  href={`/invoices/${invoice.id}/edit`}
                  onClick={() => onOpenChange(false)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-sunken px-3.5 text-[13px] font-semibold text-ink transition-colors hover:bg-line"
                >
                  <Pencil className="size-4" aria-hidden />
                  Edit
                </Link>
              ) : null}
              {invoice.permissions.canCancel && onCancelInvoice ? (
                <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-fill hover:text-danger-deep" onClick={() => onCancelInvoice(invoice)}>
                  <Ban className="size-4" aria-hidden />
                  Cancel invoice
                </Button>
              ) : null}
              <D.Close className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-sunken hover:text-ink" aria-label="Close preview">
                <X className="size-4" aria-hidden />
              </D.Close>
            </div>
          </div>
          <div ref={boxRef} className="min-h-0 flex-1 overflow-y-auto p-3 tab:p-6">
            <div style={{ height: fit.height || undefined, width: A4_WIDTH * fit.scale }} className="mx-auto">
              <div
                ref={docRef}
                style={{ transform: `scale(${fit.scale})`, transformOrigin: "top left", width: A4_WIDTH }}
                className="overflow-hidden rounded-sm shadow-[0_1px_3px_rgba(15,23,42,0.12),0_12px_40px_-12px_rgba(15,23,42,0.25)]"
              >
                <InvoiceDocument invoice={invoice} copyLabel={duplicate ? "DUPLICATE FOR SUPPLIER" : undefined} />
              </div>
            </div>
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
