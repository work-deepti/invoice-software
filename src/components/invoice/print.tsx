"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { InvoiceDocument } from "./invoice-document";
import type { SavedInvoice } from "./types";

type PrintFn = (invoice: SavedInvoice, opts?: { duplicate?: boolean }) => void;
const Ctx = createContext<PrintFn>(() => {});
export const usePrint = () => useContext(Ctx);

/**
 * PRT-04: opens the browser's print dialog with only the invoice on the page.
 * The invoice renders into #print-root (hidden on screen); @media print hides
 * everything else. The A4 page footer "<number> · Page x of y" comes from an
 * @page margin box written for this invoice.
 */
export function PrintProvider({ children }: { children: ReactNode }) {
  const [job, setJob] = useState<{ invoice: SavedInvoice; duplicate: boolean; n: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const print = useCallback<PrintFn>((invoice, opts) => {
    setJob((j) => ({ invoice, duplicate: !!opts?.duplicate, n: (j?.n ?? 0) + 1 }));
  }, []);

  useEffect(() => {
    if (!job) return;
    const prevTitle = document.title;
    document.title = job.invoice.number.replace(/\//g, "-");
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => window.print());
    });
    const done = () => {
      document.title = prevTitle;
    };
    window.addEventListener("afterprint", done, { once: true });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.removeEventListener("afterprint", done);
      document.title = prevTitle;
    };
  }, [job]);

  const footer = job ? `${job.invoice.number} · Page ` : "";

  return (
    <Ctx.Provider value={print}>
      {children}
      {mounted && job
        ? createPortal(
            <div id="print-root" key={job.n}>
              <style>{`@page { @bottom-right { content: "${footer.replace(/"/g, "")}" counter(page) " of " counter(pages); font: 8pt Figtree, sans-serif; color: #6b6a73; } }`}</style>
              <InvoiceDocument invoice={job.invoice} copyLabel={job.duplicate ? "DUPLICATE FOR SUPPLIER" : undefined} />
            </div>,
            document.body,
          )
        : null}
    </Ctx.Provider>
  );
}
