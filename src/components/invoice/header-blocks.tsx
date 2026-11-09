"use client";
import { History, Phone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PAY_MODES, formatDateDMY, sanitizeGstin, sanitizePan, sanitizePhone, type PayMode } from "@/lib/calc-engine";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { Card, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DateField } from "@/components/ui/date-field";
import { Field, Select, TextArea, TextInput } from "@/components/ui/field";
import { STATES, type CustomerForm, type FormState } from "./form-state";
import type { ErrorFor } from "./line-items";

/* ── 6.1 Invoice details ─────────────────────────────────────────────── */

export function DetailsCard({
  form,
  number,
  today,
  errorFor,
  onChange,
  onGst,
  onInterState,
  editing,
}: {
  form: FormState;
  editing: boolean;
  number: string | null;
  today: string;
  errorFor: ErrorFor;
  onChange: (patch: Partial<FormState>) => void;
  onGst: (on: boolean) => void;
  onInterState: (on: boolean) => void;
}) {
  return (
    <Card aria-labelledby="details-h" className="pb-4">
      <CardHeader title={<span id="details-h">Invoice details</span>} />
      <div className="grid grid-cols-2 gap-3 px-4 pt-3 tab:px-5">
        <Field label="Invoice no." className="col-span-2" hint={editing ? undefined : "Next in the series — confirmed when you save"}>
          {(p) => (
            <output
              id={p.id}
              className="num flex h-9 items-center rounded-lg border border-dashed border-line-strong bg-sunken/60 px-3 text-[14px] font-medium text-ink"
            >
              {number ?? <span aria-label="Loading the next number" className="block h-3 w-32 animate-pulse rounded bg-line" />}
            </output>
          )}
        </Field>
        <Field label="Date" field="date" error={errorFor("date")}>
          {(p) => (
            <DateField {...p} max={today} value={form.date} onValueChange={(date) => onChange({ date })} />
          )}
        </Field>
        <Field label="Payment mode" field="payMode" error={errorFor("payMode")}>
          {(p) => (
            <Select {...p} value={form.payMode} onChange={(e) => onChange({ payMode: e.target.value as PayMode })}>
              {PAY_MODES.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Payment details" field="payDetails" className="col-span-2" hint="Bank name, cheque or UPI reference">
          {(p) => (
            <TextInput
              {...p}
              value={form.payDetails}
              maxLength={120}
              onChange={(e) => onChange({ payDetails: e.target.value })}
              placeholder="e.g. HDFC Bank"
              autoComplete="off"
            />
          )}
        </Field>
        <div className="col-span-2 mt-1 flex flex-wrap gap-x-6 gap-y-2.5">
          <Checkbox checked={form.gstOn} onCheckedChange={onGst} label="Add GST" />
          <Checkbox
            checked={form.gstOn && form.interState}
            disabled={!form.gstOn}
            onCheckedChange={onInterState}
            label="Inter-state (IGST)"
          />
        </div>
      </div>
    </Card>
  );
}

/* ── 6.2 Customer ────────────────────────────────────────────────────── */

interface Suggestion {
  phone: string | null;
  name: string;
  address: string;
  gstin: string;
  pan: string;
  state: string;
  lastInvoiceAt: string | null;
}

export function CustomerCard({
  customer,
  showPanDeclaration,
  errorFor,
  onChange,
}: {
  customer: CustomerForm;
  showPanDeclaration: boolean;
  errorFor: ErrorFor;
  onChange: (patch: Partial<CustomerForm>) => void;
}) {
  return (
    <Card aria-labelledby="cust-h" className="pb-4">
      <CardHeader title={<span id="cust-h">Customer</span>} description="Type a phone number to recall a past customer." />
      <div className="grid grid-cols-1 gap-3 px-4 pt-3 tab:grid-cols-2 tab:px-5 lg:grid-cols-6">
        <PhoneRecall customer={customer} error={errorFor("customer.phone")} onChange={onChange} className="lg:col-span-2" />
        <Field label="Name" field="customer.name" error={errorFor("customer.name")} className="lg:col-span-2">
          {(p) => (
            <TextInput {...p} value={customer.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Cash customer" autoComplete="off" />
          )}
        </Field>
        <Field label="State" field="customer.state" className="lg:col-span-2" hint="Decides CGST + SGST or IGST">
          {(p) => (
            <>
              <TextInput {...p} list="in-states" value={customer.state} onChange={(e) => onChange({ state: e.target.value })} placeholder="Same as shop" autoComplete="off" />
              <datalist id="in-states">
                {STATES.map(([s, c]) => (
                  <option key={c} value={s} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <Field label="GSTIN" field="customer.gstin" error={errorFor("customer.gstin")} className="lg:col-span-2">
          {(p) => (
            <TextInput
              {...p}
              value={customer.gstin}
              onChange={(e) => onChange({ gstin: sanitizeGstin(e.target.value) })}
              placeholder="Optional"
              maxLength={15}
              autoCapitalize="characters"
              autoComplete="off"
              className="num"
            />
          )}
        </Field>
        <div className="flex flex-col gap-2 lg:col-span-2">
          <Field label="PAN" field="customer.pan" error={errorFor("customer.pan")} hint={errorFor("customer.pan") ? undefined : "Needed for ₹2 lakh+"}>
            {(p) => (
              <TextInput
                {...p}
                value={customer.pan}
                onChange={(e) => onChange({ pan: sanitizePan(e.target.value) })}
                placeholder="Optional"
                maxLength={10}
                autoCapitalize="characters"
                autoComplete="off"
                className="num"
              />
            )}
          </Field>
          {showPanDeclaration || customer.panDeclaration ? (
            <Checkbox
              checked={customer.panDeclaration}
              onCheckedChange={(v) => onChange({ panDeclaration: v })}
              label="No-PAN declaration (Form 60) received"
              className="animate-enter"
            />
          ) : null}
        </div>
        <Field label="Address" field="customer.address" className="tab:col-span-2">
          {(p) => <TextArea {...p} value={customer.address} onChange={(e) => onChange({ address: e.target.value })} rows={2} className="min-h-[60px]" />}
        </Field>
      </div>
    </Card>
  );
}

/** INV-07: command-style autocomplete on the 10-digit phone field. */
function PhoneRecall({
  customer,
  error,
  onChange,
  className,
}: {
  customer: CustomerForm;
  error: string | null;
  onChange: (patch: Partial<CustomerForm>) => void;
  className?: string;
}) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const filledFor = useRef<string | null>(null);
  const phone = customer.phone;
  const customerRef = useRef(customer);
  useEffect(() => {
    customerRef.current = customer;
  });

  // Suggestions as the number is typed
  useEffect(() => {
    if (phone.length < 3 || phone.length >= 10) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems([]);
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await api<{ suggestions: Suggestion[] }>(`/api/customers?q=${phone}`, { signal: ctl.signal });
        if (r.ok) {
          setItems(r.data.suggestions);
          setActive(0);
        }
      } catch {
        /* aborted */
      }
    }, 120);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [phone]);

  // A full number that matches a past customer fills any empty fields
  useEffect(() => {
    if (phone.length !== 10 || filledFor.current === phone) return;
    const ctl = new AbortController();
    void api<{ customer: Suggestion | null }>(`/api/customers?phone=${phone}`, { signal: ctl.signal })
      .then((r) => {
        if (!r.ok || !r.data.customer) return;
        filledFor.current = phone;
        onChange(fillEmpty(customerRef.current, r.data.customer));
      })
      .catch(() => {});
    return () => ctl.abort();
  }, [phone, onChange]);

  const pick = (s: Suggestion) => {
    filledFor.current = s.phone;
    onChange({ ...fillEmpty({ ...customer, phone: s.phone ?? "" }, s), phone: s.phone ?? "" });
    setOpen(false);
  };

  const show = open && items.length > 0;

  return (
    <Field label="Phone" field="customer.phone" error={error} className={cn("relative", className)}>
      {(p) => (
        <div className="relative">
          <Phone className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-faint" aria-hidden />
          <TextInput
            {...p}
            value={phone}
            inputMode="tel"
            autoComplete="off"
            placeholder="10-digit mobile"
            role="combobox"
            aria-expanded={show}
            aria-controls="phone-recall"
            aria-autocomplete="list"
            aria-activedescendant={show ? `phone-opt-${active}` : undefined}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onChange={(e) => {
              onChange({ phone: sanitizePhone(e.target.value) });
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (!show) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => (a + 1) % items.length);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => (a - 1 + items.length) % items.length);
              } else if (e.key === "Enter") {
                e.preventDefault();
                pick(items[active]);
              } else if (e.key === "Escape") {
                e.stopPropagation();
                setOpen(false);
              }
            }}
            className="num pl-8"
          />
          {show ? (
            <ul
              id="phone-recall"
              role="listbox"
              className="absolute top-[calc(100%+6px)] right-0 left-0 z-30 max-h-72 animate-enter overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-pop"
            >
              {items.map((s, i) => (
                <li
                  key={s.phone ?? i}
                  id={`phone-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(s);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-[13.5px]",
                    i === active && "bg-sunken",
                  )}
                >
                  <span className="min-w-0">
                    <span className="num block font-medium text-ink">{s.phone}</span>
                    <span className="block truncate text-[12.5px] text-muted">{s.name || "No name"}{s.state ? ` · ${s.state}` : ""}</span>
                  </span>
                  {s.lastInvoiceAt ? (
                    <span className="flex shrink-0 items-center gap-1 text-[11.5px] text-faint">
                      <History className="size-3" aria-hidden />
                      {formatDateDMY(s.lastInvoiceAt)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </Field>
  );
}

function fillEmpty(c: CustomerForm, s: Suggestion): Partial<CustomerForm> {
  const patch: Partial<CustomerForm> = {};
  if (!c.name && s.name) patch.name = s.name;
  if (!c.address && s.address) patch.address = s.address;
  if (!c.gstin && s.gstin) patch.gstin = s.gstin;
  if (!c.pan && s.pan) patch.pan = s.pan;
  if (!c.state && s.state) patch.state = s.state;
  return patch;
}
