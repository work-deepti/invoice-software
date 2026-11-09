"use client";
import { ArrowLeft, Eraser } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyRateMaster,
  computeInvoice,
  defaultHsnFor,
  detectInterState,
  formatINR,
  todayIST,
  toDec,
  validateInvoice,
  type Issue,
  type Metal,
} from "@/lib/calc-engine";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { TextArea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/components/shell/session";
import {
  blankExchange,
  blankForm,
  blankLine,
  formFromSaved,
  toBody,
  toEngineInput,
  type CustomerForm,
  type ExchangeForm,
  type FormState,
  type LineForm,
} from "./form-state";
import { CustomerCard, DetailsCard } from "./header-blocks";
import { ExchangeCard, ItemsCard } from "./line-items";
import { InvoicePreviewDialog } from "./preview-dialog";
import { usePrint } from "./print";
import { Dock, SummaryCard, type SaveAction } from "./summary";
import type { SavedInvoice } from "./types";

function focusField(field: string) {
  const el = document.querySelector<HTMLElement>(`[data-field="${CSS.escape(field)}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.focus({ preventScroll: true });
}

/** §6 — one screen, five blocks; totals update on every keystroke. */
export function InvoiceWorkspace({ editId }: { editId?: string }) {
  const { settings, rates, capabilities } = useSession();
  const toast = useToast();
  const print = usePrint();
  const today = todayIST();

  const [form, setForm] = useState<FormState>(() => blankForm(rates, settings, today));
  const [source, setSource] = useState<SavedInvoice | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nextNumber, setNextNumber] = useState<string | null>(null);
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Issue[] | null>(null);
  const [pending, setPending] = useState<{ warnings: Issue[]; action: SaveAction } | null>(null);
  const [busy, setBusy] = useState<SaveAction | null>(null);
  const [preview, setPreview] = useState<SavedInvoice | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<SavedInvoice | null>(null);
  /** Bumped after every save so the next-number preview refreshes. */
  const [seriesTick, setSeriesTick] = useState(0);
  const focusLine = useRef<number | null>(null);

  const editing = !!editId;
  const gstRate = editing ? (source?.gstRate ?? settings.gstRate) : settings.gstRate;

  /* ── load the bill in edit mode (INV-19) ─────────────────────────── */
  useEffect(() => {
    if (!editId) return;
    let live = true;
    void api<{ invoice: SavedInvoice }>(`/api/invoices/${editId}`).then((r) => {
      if (!live) return;
      if (!r.ok) return setLoadError(r.error.message);
      if (!r.data.invoice.permissions.canEdit)
        return setLoadError(
          r.data.invoice.status === "cancelled" ? "This invoice is cancelled and can't be edited." : "You can't edit this invoice. Billing staff can edit only bills created today.",
        );
      setSource(r.data.invoice);
      setForm(formFromSaved(r.data.invoice));
    });
    return () => {
      live = false;
    };
  }, [editId]);

  /* ── RATE-09: unpriced-by-hand lines follow the rate master (new bills only) ── */
  const lastRates = useRef(rates);
  useEffect(() => {
    if (editing || lastRates.current === rates) return;
    lastRates.current = rates;
    setForm((f) => ({
      ...f,
      lines: applyRateMaster(f.lines, rates.rows),
      exchange: f.exchange.map((x) => (x.fineRateManual ? x : { ...x, fineRate: rates.fineRates[x.metal] ?? "" })),
    }));
  }, [rates, editing]);

  /* ── NUM-07: preview number follows the GST switch and the date ───── */
  useEffect(() => {
    if (editing) return;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      api<{ number: string | null }>("/api/invoices/preview", {
        method: "POST",
        body: { date: form.date, payMode: "Cash", gstOn: form.gstOn, lines: [] },
        signal: ctl.signal,
      })
        .then((r) => r.ok && setNextNumber(r.data.number))
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [form.gstOn, form.date, editing, seriesTick]);

  /* ── live engine (< 16 ms) ───────────────────────────────────────── */
  const input = useMemo(() => toEngineInput(form, gstRate), [form, gstRate]);
  const totals = useMemo(() => computeInvoice(input), [input]);
  const validation = useMemo(
    () =>
      validateInvoice(
        input,
        {
          today,
          isNew: !editing,
          todaysRates: rates.rows.filter((r) => r.rate).map((r) => ({ purityId: r.id, label: r.label, rate: r.rate })),
          limits: {
            cashLimit: settings.cashLimit,
            panLimit: settings.panLimit,
            cashPayoutLimit: settings.cashPayoutLimit,
            panMissingPolicy: settings.panMissingPolicy,
          },
        },
        totals,
      ),
    [input, totals, today, editing, rates, settings],
  );

  /* ── which errors show (§8.2: live ones while typing, the rest on leave / save) ── */
  const { errorFor, chips } = useMemo(() => {
    const visible = validation.errors.filter((e) => e.live || submitted || touched.has(e.field));
    const map = new Map<string, Issue>();
    for (const e of [...visible, ...(serverErrors ?? [])]) if (!map.has(e.field)) map.set(e.field, e);
    const all = submitted ? [...validation.errors, ...(serverErrors ?? [])] : [];
    const seen = new Set<string>();
    const chips = all.filter((e) => {
      const k = `${e.id}|${e.field}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return { errorFor: (f: string) => map.get(f)?.message ?? null, chips };
  }, [validation.errors, serverErrors, submitted, touched]);

  /* ── updates ─────────────────────────────────────────────────────── */
  const patch = useCallback((p: Partial<FormState> | ((f: FormState) => FormState)) => {
    setForm((f) => (typeof p === "function" ? p(f) : { ...f, ...p }));
    setServerErrors(null);
  }, []);

  const onCustomer = useCallback(
    (p: Partial<CustomerForm>) =>
      patch((f) => {
        const customer = { ...f.customer, ...p };
        // GST-02: auto-tick IGST when both states are filled and differ — until the user overrides it
        const interState = !f.interStateManual && "state" in p ? detectInterState(customer.state, settings.state) : f.interState;
        return { ...f, customer, interState };
      }),
    [patch, settings.state],
  );

  const onLine = useCallback(
    (i: number, p: Partial<LineForm>) => patch((f) => ({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, ...p } : l)) })),
    [patch],
  );

  const onPurity = useCallback(
    (i: number, purityId: string) => {
      const row = rates.rows.find((r) => r.id === purityId);
      if (!row) return;
      onLine(i, {
        purityId: row.id,
        metal: row.metal,
        purityLabel: row.label,
        hsn: defaultHsnFor(row.metal, settings),
        rate: row.rate,
        rateManual: false,
      });
    },
    [rates.rows, settings, onLine],
  );

  const onResetRate = useCallback(
    (i: number) => {
      const row = rates.rows.find((r) => r.id === form.lines[i]?.purityId);
      onLine(i, { rate: row?.rate ?? "", rateManual: false });
    },
    [rates.rows, form.lines, onLine],
  );

  const addLine = useCallback(() => {
    patch((f) => {
      focusLine.current = f.lines.length;
      return { ...f, lines: [...f.lines, blankLine(rates, settings, f.lines.at(-1))] };
    });
  }, [patch, rates, settings]);

  const removeLine = useCallback(
    (i: number) =>
      patch((f) => ({
        ...f,
        // the last remaining line is replaced by a blank one
        lines: f.lines.length === 1 ? [blankLine(rates, settings)] : f.lines.filter((_, j) => j !== i),
      })),
    [patch, rates, settings],
  );

  useEffect(() => {
    if (focusLine.current === null) return;
    const i = focusLine.current;
    focusLine.current = null;
    document.querySelector<HTMLElement>(`[data-field="lines.${i}.description"]`)?.focus();
  }, [form.lines.length]);

  const onExchange = useCallback(
    (i: number, p: Partial<ExchangeForm>) => patch((f) => ({ ...f, exchange: f.exchange.map((x, j) => (j === i ? { ...x, ...p } : x)) })),
    [patch],
  );
  const onExchangeMetal = useCallback(
    (i: number, metal: Metal) =>
      patch((f) => ({
        ...f,
        exchange: f.exchange.map((x, j) =>
          j === i
            ? {
                ...x,
                metal,
                fineRate: x.fineRateManual ? x.fineRate : (rates.fineRates[metal] ?? ""),
                description: /^old (gold|silver|platinum|other)$/i.test(x.description) ? `Old ${metal.toLowerCase()}` : x.description,
              }
            : x,
        ),
      })),
    [patch, rates.fineRates],
  );

  const reset = useCallback(() => {
    setForm(blankForm(rates, settings, todayIST()));
    setTouched(new Set());
    setSubmitted(false);
    setServerErrors(null);
  }, [rates, settings]);

  /* ── save (INV-17) ───────────────────────────────────────────────── */
  const save = useCallback(
    async (action: SaveAction, acceptWarnings = false) => {
      if (busy) return;
      setSubmitted(true);
      if (validation.errors.length) {
        focusField(validation.errors[0].field);
        return;
      }
      setBusy(action);
      const body = toBody(form, acceptWarnings);
      const r = editId
        ? await api<{ invoice: SavedInvoice }>(`/api/invoices/${editId}`, { method: "PUT", body })
        : await api<{ invoice: SavedInvoice }>("/api/invoices", { method: "POST", body });
      setBusy(null);
      if (!r.ok) {
        if (r.status === 422 && r.error.errors?.length) {
          setServerErrors(r.error.errors);
          focusField(r.error.errors[0].field);
        } else if (r.status === 409 && r.error.warnings?.length) {
          setPending({ warnings: r.error.warnings, action });
        } else {
          toast(r.error.message, "error");
        }
        return;
      }
      const inv = r.data.invoice;
      setPending(null);
      setSeriesTick((n) => n + 1);
      toast(
        <>
          {editing ? "Updated" : "Saved"} <span className="num font-medium">{inv.number}</span> · <span className="num">{formatINR(toDec(inv.grandTotal).abs())}</span>
        </>,
      );
      if (action === "print") print(inv);
      if (action === "view") setPreview(inv);
      if (editing) {
        setSource(inv);
        setForm(formFromSaved(inv));
        setSubmitted(false);
        setTouched(new Set());
      } else {
        reset();
      }
    },
    [busy, validation.errors, form, editId, editing, toast, print, reset],
  );

  /* ── keyboard (UX-08): Alt+N new item, Ctrl+S save, Ctrl+P save & print ── */
  const saveRef = useRef(save);
  const addRef = useRef(addLine);
  useEffect(() => {
    saveRef.current = save;
    addRef.current = addLine;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector("[role=dialog]")) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveRef.current("save");
      } else if (mod && e.key.toLowerCase() === "p") {
        e.preventDefault();
        void saveRef.current("print");
      } else if (e.altKey && e.code === "KeyN") {
        e.preventDefault();
        addRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ── render ──────────────────────────────────────────────────────── */
  if (!capabilities.canBill)
    return <Notice title="Viewing only" text="Your account can view and print invoices but can't create or edit them." />;
  if (loadError) return <Notice title="Can't open this invoice" text={loadError} back />;
  if (editing && !source)
    return (
      <div className="space-y-4" aria-busy>
        <div className="h-8 w-64 animate-pulse rounded-md bg-line/70" />
        <div className="h-48 animate-pulse rounded-xl bg-line/50" />
        <div className="h-72 animate-pulse rounded-xl bg-line/40" />
      </div>
    );

  const panLimitHit = toDec(totals.grandTotal).gte(toDec(settings.panLimit)) && !form.customer.pan;

  return (
    <div
      className="pb-36"
      onBlurCapture={(e) => {
        const f = (e.target as HTMLElement).dataset?.field;
        if (f && !touched.has(f)) setTouched((t) => new Set(t).add(f));
      }}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="tight flex flex-wrap items-baseline gap-x-2.5 text-[22px] font-semibold text-ink">
            {editing ? (
              <>
                Editing <span className="num text-[20px] font-medium text-ink-3">{source?.number}</span>
              </>
            ) : (
              "New invoice"
            )}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <Link
              href="/invoices/new"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 text-sm font-medium text-ink shadow-hair transition-colors hover:border-line-strong hover:bg-canvas"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Cancel editing
            </Link>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmClear(true)}>
              <Eraser className="size-4" aria-hidden />
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.1fr)]">
          <DetailsCard
            form={form}
            number={editing ? (source?.number ?? null) : nextNumber}
            editing={editing}
            today={today}
            errorFor={errorFor}
            onChange={patch}
            onGst={(on) => patch({ gstOn: on })}
            onInterState={(on) => patch({ interState: on, interStateManual: true })}
          />
          <CustomerCard customer={form.customer} showPanDeclaration={panLimitHit} errorFor={errorFor} onChange={onCustomer} />
        </div>

        <ItemsCard
          lines={form.lines}
          results={totals.lines}
          rates={rates}
          errorFor={errorFor}
          onLine={onLine}
          onPurity={onPurity}
          onAdd={addLine}
          onRemove={removeLine}
          onResetRate={onResetRate}
        />

        <ExchangeCard
          rows={form.exchange}
          results={totals.exchange}
          errorFor={errorFor}
          onRow={onExchange}
          onMetal={onExchangeMetal}
          onAdd={() => patch((f) => ({ ...f, exchange: [...f.exchange, blankExchange(rates)] }))}
          onRemove={(i) => patch((f) => ({ ...f, exchange: f.exchange.filter((_, j) => j !== i) }))}
        />

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
          <Card aria-labelledby="notes-h" className="pb-4">
            <CardHeader title={<span id="notes-h">Notes</span>} description="Printed on the invoice." />
            <div className="px-4 pt-3 tab:px-5">
              <label htmlFor="inv-notes" className="sr-only">
                Notes
              </label>
              <TextArea id="inv-notes" data-field="notes" value={form.notes} onChange={(e) => patch({ notes: e.target.value })} rows={5} placeholder="e.g. Exchange of old bangles; delivery on Friday" />
            </div>
          </Card>
          <SummaryCard form={form} totals={totals} errorFor={errorFor} onChange={patch} />
        </div>
      </div>

      <Dock totals={totals} editing={editing} busy={busy} chips={chips} onChip={focusField} onSave={(a) => void save(a)} />

      {/* §8.3: all warnings together, one confirmation */}
      <Dialog
        open={!!pending}
        onOpenChange={(v) => !v && setPending(null)}
        title="Check before saving"
        description={pending && pending.warnings.length > 1 ? "These need your attention:" : "This needs your attention:"}
        footer={
          <>
            <Button onClick={() => setPending(null)}>Go back</Button>
            <Button variant="primary" loading={!!busy} onClick={() => pending && void save(pending.action, true)}>
              Save anyway
            </Button>
          </>
        }
      >
        <ul className="space-y-2.5">
          {pending?.warnings.map((w, i) => (
            <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-ink">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-gold" />
              {w.message}
            </li>
          ))}
        </ul>
      </Dialog>

      <Dialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear this bill?"
        description="Everything typed on this screen will be removed. Saved invoices are not affected."
        footer={
          <>
            <Button onClick={() => setConfirmClear(false)}>Keep editing</Button>
            <Button
              variant="danger"
              onClick={() => {
                reset();
                setConfirmClear(false);
              }}
            >
              Clear bill
            </Button>
          </>
        }
      />

      <InvoicePreviewDialog invoice={preview} open={!!preview} onOpenChange={(v) => !v && setPreview(null)} onCancelInvoice={setCancelTarget} />
      <CancelInvoiceDialog
        invoice={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onDone={(inv) => {
          setCancelTarget(null);
          setPreview(inv);
          toast(
            <>
              Cancelled <span className="num font-medium">{inv.number}</span>
            </>,
          );
        }}
      />
    </div>
  );
}

/** D-01: cancel with a reason; the bill stays, stamped CANCELLED, and leaves the totals. */
export function CancelInvoiceDialog({
  invoice,
  onClose,
  onDone,
}: {
  invoice: SavedInvoice | null;
  onClose: () => void;
  onDone: (inv: SavedInvoice) => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog
      open={!!invoice}
      onOpenChange={(v) => {
        if (!v) {
          setReason("");
          setError(null);
          onClose();
        }
      }}
      title={invoice ? `Cancel ${invoice.number}?` : "Cancel invoice"}
      description="The bill stays in the records marked CANCELLED and is left out of all totals. Its number is never reused."
      footer={
        <>
          <Button onClick={onClose}>Keep invoice</Button>
          <Button
            variant="danger"
            loading={busy}
            disabled={!reason.trim()}
            onClick={async () => {
              if (!invoice) return;
              setBusy(true);
              const r = await api<{ invoice: SavedInvoice }>(`/api/invoices/${invoice.id}/cancel`, { method: "POST", body: { reason } });
              setBusy(false);
              if (!r.ok) return setError(r.error.message);
              setReason("");
              onDone(r.data.invoice);
            }}
          >
            Cancel invoice
          </Button>
        </>
      }
    >
      <label htmlFor="cancel-reason" className="text-[12.5px] font-medium text-ink-3">
        Reason
      </label>
      <TextArea id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer returned the ring" className="mt-1.5" autoFocus />
      {error ? <p className="mt-2 text-[13px] text-danger">{error}</p> : null}
    </Dialog>
  );
}

function Notice({ title, text, back }: { title: string; text: string; back?: boolean }) {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-xl border border-line bg-surface p-6 text-center shadow-hair">
      <h1 className="tight text-[17px] font-semibold text-ink">{title}</h1>
      <p className="mt-1.5 text-[14px] text-muted">{text}</p>
      {back ? (
        <Link href="/invoices/new" className="mt-4 inline-block text-[14px] font-medium text-ink underline">
          Go to new invoice
        </Link>
      ) : null}
    </div>
  );
}
