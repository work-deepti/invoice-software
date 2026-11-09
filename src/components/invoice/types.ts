import type { InvoiceDTO } from "@/server/invoices";
import type { SettingsDTO } from "@/server/settings";

/** JSON shape of a value after it went through Response.json(): Dates become strings. */
export type Serialized<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T;

/** A saved invoice as the API returns it. */
export type SavedInvoice = Serialized<InvoiceDTO>;

export function snapshotOf(inv: SavedInvoice): SettingsDTO {
  return inv.shopSnapshot as unknown as SettingsDTO;
}
