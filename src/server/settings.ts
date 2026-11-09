import "server-only";
import { eq, sql } from "drizzle-orm";
import {
  DEFAULT_LIMITS,
  sanitizeGstin,
  sanitizePhone,
  sanitizeStateCode,
  validateSettings,
  type ComplianceLimits,
  type Issue,
  type ShopSettings,
} from "@/lib/calc-engine";
import { writeAudit } from "./audit";
import type { SessionUser } from "./auth";
import { getDb, type Tx } from "./db";
import { shopSettings, type ShopSettingsRow } from "./db/schema";
import { validationFailed } from "./http";
import { settingsBodySchema } from "./schemas";

export interface SettingsDTO extends ShopSettings {
  cashLimit: string;
  panLimit: string;
  cashPayoutLimit: string;
  panMissingPolicy: "block" | "warn";
}

/** Reads the single settings row, creating it with defaults on first use. */
export async function loadSettingsRow(tx: Tx = getDb()): Promise<ShopSettingsRow> {
  const [row] = await tx.select().from(shopSettings).where(eq(shopSettings.id, 1)).limit(1);
  if (row) return row;
  await tx.insert(shopSettings).values({ id: 1 }).onConflictDoNothing();
  const [created] = await tx.select().from(shopSettings).where(eq(shopSettings.id, 1)).limit(1);
  return created;
}

const trimZeros = (v: string) => (v.includes(".") ? v.replace(/\.?0+$/, "") : v);

export function toSettingsDTO(r: ShopSettingsRow): SettingsDTO {
  return {
    name: r.name,
    phone: r.phone,
    email: r.email,
    gstin: r.gstin,
    state: r.state,
    stateCode: r.stateCode,
    address: r.address,
    gstRate: trimZeros(r.gstRate),
    gstDefault: r.gstDefault,
    prefixGst: r.prefixGst,
    prefixNoGst: r.prefixNoGst,
    noGstTitle: r.noGstTitle,
    hsnGold: r.hsnGold,
    hsnSilver: r.hsnSilver,
    fyNumbering: r.fyNumbering,
    terms: r.terms,
    bankDetails: r.bankDetails,
    signatoryLabel: r.signatoryLabel,
    staffCanSeeDashboard: r.staffCanSeeDashboard,
    cashLimit: r.cashLimit,
    panLimit: r.panLimit,
    cashPayoutLimit: r.cashPayoutLimit,
    panMissingPolicy: r.panMissingPolicy === "warn" ? "warn" : "block",
  };
}

export function limitsFrom(r: ShopSettingsRow): ComplianceLimits {
  return {
    ...DEFAULT_LIMITS,
    cashLimit: r.cashLimit,
    panLimit: r.panLimit,
    cashPayoutLimit: r.cashPayoutLimit,
    panMissingPolicy: r.panMissingPolicy === "warn" ? "warn" : "block",
  };
}

export async function getSettings(): Promise<SettingsDTO> {
  return toSettingsDTO(await loadSettingsRow());
}

const POSITIVE_MONEY = /^\d{1,12}(\.\d{1,2})?$/;

/** PUT /api/settings (owner). S-01..S-10 → 422. */
export async function saveSettings(body: unknown, user: SessionUser): Promise<SettingsDTO> {
  const b = settingsBodySchema.parse(body);
  const next: SettingsDTO = {
    name: b.name.trim(),
    phone: sanitizePhone(b.phone),
    email: b.email.trim(),
    gstin: sanitizeGstin(b.gstin),
    state: b.state.trim(),
    stateCode: sanitizeStateCode(b.stateCode),
    address: b.address.trim(),
    gstRate: String(b.gstRate).trim(),
    gstDefault: b.gstDefault,
    prefixGst: b.prefixGst.trim(),
    prefixNoGst: b.prefixNoGst.trim(),
    noGstTitle: b.noGstTitle.trim() || "INVOICE",
    hsnGold: b.hsnGold.trim(),
    hsnSilver: b.hsnSilver.trim(),
    fyNumbering: b.fyNumbering,
    terms: b.terms,
    bankDetails: b.bankDetails,
    signatoryLabel: b.signatoryLabel.trim() || "Authorised Signatory",
    staffCanSeeDashboard: b.staffCanSeeDashboard,
    cashLimit: String(b.cashLimit ?? DEFAULT_LIMITS.cashLimit).trim(),
    panLimit: String(b.panLimit ?? DEFAULT_LIMITS.panLimit).trim(),
    cashPayoutLimit: String(b.cashPayoutLimit ?? DEFAULT_LIMITS.cashPayoutLimit).trim(),
    panMissingPolicy: b.panMissingPolicy ?? "block",
  };

  // Inputs are normalised exactly as the UI does (VAL-02/03/04) before S-01..S-10 run.
  const { errors } = validateSettings(next);
  const limitErrors: Issue[] = (["cashLimit", "panLimit", "cashPayoutLimit"] as const)
    .filter((k) => !POSITIVE_MONEY.test(next[k]) || Number(next[k]) <= 0)
    .map((k) => ({ id: "S-11", field: k, message: "Compliance limits must be amounts greater than 0." }));
  const all = [...errors, ...limitErrors];
  if (all.length) throw validationFailed(all);

  return getDb().transaction(async (tx) => {
    const before = await loadSettingsRow(tx);
    await tx.execute(sql`select 1 from shop_settings where id = 1 for update`);
    const [row] = await tx
      .update(shopSettings)
      .set({ ...next, updatedAt: new Date(), updatedBy: user.id })
      .where(eq(shopSettings.id, 1))
      .returning();
    await writeAudit(tx, {
      userId: user.id,
      entity: "shop_settings",
      entityId: "1",
      action: "settings",
      before: toSettingsDTO(before),
      after: toSettingsDTO(row),
    });
    return toSettingsDTO(row);
  });
}
