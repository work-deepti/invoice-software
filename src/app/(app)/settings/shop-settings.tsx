"use client";
import { KeyRound, UserPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  formatInvoiceNumber,
  maxPrefixLength,
  sanitizeDecimalText,
  sanitizeGstin,
  sanitizePhone,
  sanitizeStateCode,
  todayIST,
  validateSettings,
  type Issue,
} from "@/lib/calc-engine";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import type { SettingsDTO } from "@/server/settings";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select, TextArea, TextInput } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { STATES } from "@/components/invoice/form-state";
import { useSession } from "@/components/shell/session";

type Form = SettingsDTO;

export function ShopSettings() {
  const { settings, setSettings, capabilities, user } = useSession();
  const toast = useToast();
  const [form, setForm] = useState<Form>(settings);
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Issue[] | null>(null);
  const [busy, setBusy] = useState(false);

  const validation = useMemo(() => validateSettings(form), [form]);
  const errorFor = (field: string) => {
    const e =
      serverErrors?.find((x) => x.field === field) ??
      validation.errors.find((x) => x.field === field && (submitted || touched.has(field)));
    return e?.message ?? null;
  };
  const dirty = JSON.stringify(form) !== JSON.stringify(settings);
  const set = (patch: Partial<Form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setServerErrors(null);
  };

  if (!capabilities.isOwner)
    return (
      <div className="mx-auto mt-10 max-w-md rounded-xl border border-line bg-surface p-6 text-center shadow-hair">
        <h1 className="tight text-[17px] font-semibold">Owner only</h1>
        <p className="mt-1.5 text-[14px] text-muted">Only the shop owner can change shop settings.</p>
      </div>
    );

  async function save() {
    setSubmitted(true);
    if (validation.errors.length) {
      document.querySelector<HTMLElement>(`[data-field="${validation.errors[0].field}"]`)?.focus();
      return;
    }
    setBusy(true);
    const r = await api<{ settings: SettingsDTO }>("/api/settings", { method: "PUT", body: form });
    setBusy(false);
    if (!r.ok) {
      if (r.status === 422 && r.error.errors) setServerErrors(r.error.errors);
      else toast(r.error.message, "error");
      return;
    }
    setSettings(r.data.settings);
    setForm(r.data.settings);
    setSubmitted(false);
    toast("Shop settings saved");
  }

  const today = todayIST();
  const sample = (prefix: string) => {
    try {
      return prefix ? formatInvoiceNumber(prefix, today, 1, form.fyNumbering) : "—";
    } catch {
      return "—";
    }
  };

  return (
    <div
      className="flex flex-col gap-4 pb-28"
      onBlurCapture={(e) => {
        const f = (e.target as HTMLElement).dataset?.field;
        if (f && !touched.has(f)) setTouched((t) => new Set(t).add(f));
      }}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="tight text-[22px] font-semibold text-ink">Shop settings</h1>
          <p className="mt-0.5 text-[13.5px] text-muted">Printed on every invoice. Old invoices keep the details they were saved with.</p>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Section title="Business" description="Name, contact and address at the top of the invoice.">
          <Field label="Shop / business name" field="name" error={errorFor("name")} className="tab:col-span-2">
            {(p) => <TextInput {...p} value={form.name} onChange={(e) => set({ name: e.target.value })} autoComplete="organization" />}
          </Field>
          <Field label="Phone" field="phone" error={errorFor("phone")}>
            {(p) => <TextInput {...p} inputMode="tel" value={form.phone} onChange={(e) => set({ phone: sanitizePhone(e.target.value) })} className="num" />}
          </Field>
          <Field label="Email" field="email" error={errorFor("email")} hint="Optional">
            {(p) => <TextInput {...p} type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />}
          </Field>
          <Field label="Address" field="address" className="tab:col-span-2">
            {(p) => <TextArea {...p} value={form.address} onChange={(e) => set({ address: e.target.value })} rows={3} />}
          </Field>
        </Section>

        <Section title="GST" description="Your registration, default GST and HSN codes.">
          <Field label="GSTIN" field="gstin" error={errorFor("gstin")} className="tab:col-span-2">
            {(p) => (
              <TextInput
                {...p}
                value={form.gstin}
                maxLength={15}
                onChange={(e) => {
                  const gstin = sanitizeGstin(e.target.value);
                  set({ gstin, ...(form.stateCode === "" && /^\d{2}/.test(gstin) ? { stateCode: gstin.slice(0, 2) } : {}) });
                }}
                className="num"
              />
            )}
          </Field>
          <Field label="State" field="state">
            {(p) => (
              <>
                <TextInput
                  {...p}
                  list="settings-states"
                  value={form.state}
                  onChange={(e) => {
                    const state = e.target.value;
                    const code = STATES.find(([s]) => s.toLowerCase() === state.trim().toLowerCase())?.[1];
                    set({ state, ...(code && !form.stateCode ? { stateCode: code } : {}) });
                  }}
                />
                <datalist id="settings-states">
                  {STATES.map(([s, c]) => (
                    <option key={c} value={s} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field label="State code" field="stateCode" error={errorFor("stateCode")}>
            {(p) => <TextInput {...p} inputMode="numeric" maxLength={2} value={form.stateCode} onChange={(e) => set({ stateCode: sanitizeStateCode(e.target.value) })} className="num" />}
          </Field>
          <Field label="GST % on gold / silver" field="gstRate" error={errorFor("gstRate")}>
            {(p) => <TextInput {...p} inputMode="decimal" value={form.gstRate} onChange={(e) => set({ gstRate: sanitizeDecimalText(e.target.value) })} className="num" />}
          </Field>
          <div className="flex items-end pb-1.5">
            <Switch checked={form.gstDefault} onCheckedChange={(v) => set({ gstDefault: v })} label="Add GST by default" className="w-full" />
          </div>
          <Field label="HSN – gold" field="hsnGold" error={errorFor("hsnGold")}>
            {(p) => <TextInput {...p} inputMode="numeric" maxLength={8} value={form.hsnGold} onChange={(e) => set({ hsnGold: e.target.value.replace(/\D/g, "") })} className="num" />}
          </Field>
          <Field label="HSN – silver" field="hsnSilver" error={errorFor("hsnSilver")}>
            {(p) => <TextInput {...p} inputMode="numeric" maxLength={8} value={form.hsnSilver} onChange={(e) => set({ hsnSilver: e.target.value.replace(/\D/g, "") })} className="num" />}
          </Field>
        </Section>

        <Section title="Invoice numbering" description={`At most 16 characters. With yearly numbering the prefix can be ${maxPrefixLength(true)} characters.`}>
          <Field label="Prefix – GST invoices" field="prefixGst" error={errorFor("prefixGst")} hint={<>Numbers look like <span className="num text-ink-3">{sample(form.prefixGst)}</span></>}>
            {(p) => <TextInput {...p} value={form.prefixGst} maxLength={10} onChange={(e) => set({ prefixGst: e.target.value.replace(/[^A-Za-z0-9-]/g, "") })} className="num" />}
          </Field>
          <Field label="Prefix – bills without GST" field="prefixNoGst" error={errorFor("prefixNoGst")} hint={<>Numbers look like <span className="num text-ink-3">{sample(form.prefixNoGst)}</span></>}>
            {(p) => <TextInput {...p} value={form.prefixNoGst} maxLength={10} onChange={(e) => set({ prefixNoGst: e.target.value.replace(/[^A-Za-z0-9-]/g, "") })} className="num" />}
          </Field>
          <Field label="Heading on bills without GST" field="noGstTitle">
            {(p) => <TextInput {...p} value={form.noGstTitle} onChange={(e) => set({ noGstTitle: e.target.value })} />}
          </Field>
          <div className="flex items-end pb-1.5">
            <Switch
              checked={form.fyNumbering}
              onCheckedChange={(v) => set({ fyNumbering: v })}
              label="Restart numbering each financial year"
              hint="April to March"
              className="w-full"
            />
          </div>
        </Section>

        <Section title="Printing" description="Terms, payment details and signature on the invoice.">
          <Field label="Terms" field="terms" className="tab:col-span-2">
            {(p) => <TextArea {...p} value={form.terms} onChange={(e) => set({ terms: e.target.value })} rows={3} />}
          </Field>
          <Field label="Bank / UPI details" field="bankDetails" className="tab:col-span-2">
            {(p) => <TextArea {...p} value={form.bankDetails} onChange={(e) => set({ bankDetails: e.target.value })} rows={3} placeholder="e.g. HDFC Bank · A/c 50100… · IFSC HDFC0001234 · UPI shop@hdfcbank" />}
          </Field>
          <Field label="Signature label" field="signatoryLabel">
            {(p) => <TextInput {...p} value={form.signatoryLabel} onChange={(e) => set({ signatoryLabel: e.target.value })} />}
          </Field>
        </Section>

        <Section title="Compliance limits" description="Tax limits change. Confirm these values with your CA every year.">
          <Field label="Cash receipt limit ₹ (s.269ST)" field="cashLimit" error={errorFor("cashLimit")}>
            {(p) => <TextInput {...p} inputMode="decimal" value={form.cashLimit} onChange={(e) => set({ cashLimit: sanitizeDecimalText(e.target.value) })} className="num" />}
          </Field>
          <Field label="PAN required from ₹ (r.114B)" field="panLimit" error={errorFor("panLimit")}>
            {(p) => <TextInput {...p} inputMode="decimal" value={form.panLimit} onChange={(e) => set({ panLimit: sanitizeDecimalText(e.target.value) })} className="num" />}
          </Field>
          <Field label="Cash payout limit ₹ (s.40A(3))" field="cashPayoutLimit" error={errorFor("cashPayoutLimit")}>
            {(p) => <TextInput {...p} inputMode="decimal" value={form.cashPayoutLimit} onChange={(e) => set({ cashPayoutLimit: sanitizeDecimalText(e.target.value) })} className="num" />}
          </Field>
          <Field label="B2C large invoice limit ₹ (GSTR-1)" field="b2cLargeLimit" error={errorFor("b2cLargeLimit")} hint="Inter-state B2C bills above this are flagged in the GST dashboard">
            {(p) => <TextInput {...p} inputMode="decimal" value={form.b2cLargeLimit} onChange={(e) => set({ b2cLargeLimit: sanitizeDecimalText(e.target.value) })} className="num" />}
          </Field>
          <Field label="Bill above the PAN limit with no PAN" field="panMissingPolicy">
            {(p) => (
              <Select {...p} value={form.panMissingPolicy} onChange={(e) => set({ panMissingPolicy: e.target.value as "block" | "warn" })}>
                <option value="block">Block unless Form 60 is ticked</option>
                <option value="warn">Warn only</option>
              </Select>
            )}
          </Field>
        </Section>

        <Section title="Access" description="What billing staff can see.">
          <Switch
            checked={form.staffCanSeeDashboard}
            onCheckedChange={(v) => set({ staffCanSeeDashboard: v })}
            label="Billing staff can see dashboards"
            className="tab:col-span-2"
          />
        </Section>
      </div>

      <TeamCard selfId={user.id} />

      {/* Save bar */}
      <div className={cn("pointer-events-none fixed inset-x-0 bottom-0 z-30 px-2 pb-[max(8px,env(safe-area-inset-bottom))] transition-transform duration-150 ease-out-expo tab:px-6 tab:pb-4", !dirty && "translate-y-[calc(100%+16px)]")}>
        <div className="pointer-events-auto mx-auto flex max-w-[1680px] items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-white shadow-dock">
          <p className="text-[13.5px] text-white/75">
            {submitted && validation.errors.length ? (
              <span className="text-red-300">{validation.errors.length === 1 ? "1 field needs fixing" : `${validation.errors.length} fields need fixing`}</span>
            ) : (
              "You have unsaved changes"
            )}
          </p>
          <div className="flex gap-2">
            <Button variant="dock" onClick={() => setForm(settings)} disabled={busy}>
              Discard
            </Button>
            <Button onClick={() => void save()} loading={busy} className="bg-white text-ink hover:bg-slate-100">
              Save settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Card className="pb-5">
      <CardHeader title={title} description={description} />
      <div className="grid grid-cols-1 gap-3.5 px-4 pt-4 tab:grid-cols-2 tab:px-5">{children}</div>
    </Card>
  );
}

/* ── Team (ROLE-01) ──────────────────────────────────────────────────── */

interface TeamUser {
  id: string;
  name: string;
  login: string;
  role: "owner" | "staff" | "viewer";
  active: boolean;
}

const ROLE_LABEL = { owner: "Owner", staff: "Billing staff", viewer: "Viewer" } as const;

function TeamCard({ selfId }: { selfId: string }) {
  const toast = useToast();
  const [users, setUsers] = useState<TeamUser[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [resetFor, setResetFor] = useState<TeamUser | null>(null);

  const load = useCallback(async () => {
    const r = await api<{ users: TeamUser[] }>("/api/users");
    if (r.ok) setUsers(r.data.users);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function update(u: TeamUser, patch: Partial<TeamUser> & { password?: string }) {
    const r = await api(`/api/users/${u.id}`, { method: "PATCH", body: patch });
    if (!r.ok) return toast(r.error.message, "error"), false;
    await load();
    return true;
  }

  return (
    <Card className="pb-4">
      <CardHeader
        title="Team"
        description="Everyone signs in with their own login. Staff bill; viewers only look and export."
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <UserPlus className="size-4" aria-hidden />
            Add person
          </Button>
        }
      />
      <div className="px-4 pt-3 tab:px-5">
        {!users ? (
          <div className="h-24 animate-pulse rounded-lg bg-line/40" />
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {users.map((u) => (
              <li key={u.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-3.5 py-3", !u.active && "opacity-55")}>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-ink">
                    {u.name}
                    {u.id === selfId ? <span className="ml-1.5 text-[12px] font-normal text-muted">(you)</span> : null}
                  </p>
                  <p className="num text-[12.5px] text-muted">{u.login}</p>
                </div>
                <Select
                  aria-label={`Role for ${u.name}`}
                  value={u.role}
                  onChange={(e) => void update(u, { role: e.target.value as TeamUser["role"] }).then((ok) => ok && toast(`${u.name} is now ${ROLE_LABEL[e.target.value as TeamUser["role"]]}`))}
                  className="h-8 w-40 text-[13px]"
                >
                  <option value="owner">Owner</option>
                  <option value="staff">Billing staff</option>
                  <option value="viewer">Viewer</option>
                </Select>
                <Button size="sm" variant="ghost" onClick={() => setResetFor(u)}>
                  <KeyRound className="size-4" aria-hidden />
                  Password
                </Button>
                <Switch
                  checked={u.active}
                  onCheckedChange={(v) => void update(u, { active: v }).then((ok) => ok && toast(`${u.name} ${v ? "can sign in again" : "can no longer sign in"}`))}
                  label={<span className="text-[13px] text-muted">{u.active ? "Active" : "Off"}</span>}
                  className="w-24"
                />
              </li>
            ))}
          </ul>
        )}
      </div>
      <AddUserDialog
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={(u) => {
          setAdding(false);
          toast(`Added ${u.name}`);
          void load();
        }}
      />
      <PasswordDialog
        user={resetFor}
        onClose={() => setResetFor(null)}
        onSave={async (pw) => {
          if (resetFor && (await update(resetFor, { password: pw }))) {
            toast(`Password changed for ${resetFor.name}`);
            setResetFor(null);
          }
        }}
      />
    </Card>
  );
}

function AddUserDialog({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (u: TeamUser) => void }) {
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<TeamUser["role"]>("staff");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="Add a person"
      description="They sign in with this login and password. You can change the role any time."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const r = await api<{ user: TeamUser }>("/api/users", { method: "POST", body: { name, login, password, role } });
              setBusy(false);
              if (!r.ok) {
                const issues = (r.error as { issues?: { message: string }[] }).issues;
                return setError(issues?.[0]?.message ?? r.error.message);
              }
              setName("");
              setLogin("");
              setPassword("");
              onAdded(r.data.user);
            }}
          >
            Add person
          </Button>
        </>
      }
    >
      <div className="grid gap-3.5 tab:grid-cols-2">
        <Field label="Name">{(p) => <TextInput {...p} value={name} onChange={(e) => setName(e.target.value)} autoFocus />}</Field>
        <Field label="Role">
          {(p) => (
            <Select {...p} value={role} onChange={(e) => setRole(e.target.value as TeamUser["role"])}>
              <option value="staff">Billing staff</option>
              <option value="viewer">Viewer</option>
              <option value="owner">Owner</option>
            </Select>
          )}
        </Field>
        <Field label="Login" hint="3–40 letters or numbers">
          {(p) => <TextInput {...p} value={login} onChange={(e) => setLogin(e.target.value.toLowerCase())} autoCapitalize="none" autoComplete="off" />}
        </Field>
        <Field label="Password" hint="At least 8 characters">
          {(p) => <TextInput {...p} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />}
        </Field>
      </div>
      {error ? <p className="mt-3 rounded-lg bg-danger-fill px-3 py-2 text-[13px] text-danger-deep">{error}</p> : null}
    </Dialog>
  );
}

function PasswordDialog({ user, onClose, onSave }: { user: TeamUser | null; onClose: () => void; onSave: (pw: string) => Promise<void> }) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={!!user}
      onOpenChange={(v) => {
        if (!v) {
          setPw("");
          onClose();
        }
      }}
      title={user ? `New password for ${user.name}` : "New password"}
      description="They'll be signed out everywhere and use the new password next time."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={pw.length < 8}
            onClick={async () => {
              setBusy(true);
              await onSave(pw);
              setBusy(false);
              setPw("");
            }}
          >
            Change password
          </Button>
        </>
      }
    >
      <Field label="New password" hint="At least 8 characters">
        {(p) => <TextInput {...p} type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" autoFocus />}
      </Field>
    </Dialog>
  );
}
