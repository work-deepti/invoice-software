import { Clock } from "lucide-react";
import Link from "next/link";

export function ComingNext({ title, text }: { title: string; text: string }) {
  return (
    <div className="mx-auto mt-6 max-w-lg rounded-xl border border-line bg-surface p-6 shadow-hair">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sunken text-muted">
          <Clock className="size-4" aria-hidden />
        </span>
        <div>
          <h1 className="tight text-[17px] font-semibold text-ink">{title}</h1>
          <p className="mt-1 text-[14px] leading-relaxed text-muted">{text}</p>
          <Link href="/invoices/new" className="mt-3 inline-block text-[14px] font-medium text-ink underline">
            Make a new invoice
          </Link>
        </div>
      </div>
    </div>
  );
}
