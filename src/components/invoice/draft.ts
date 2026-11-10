import type { FormState } from "./form-state";

/* Autosave for the bill being made (new invoices only). Lives in this browser's localStorage,
   one draft per signed-in user, so a refresh, a sleeping tablet or a crash never loses a bill. */

const VERSION = 1;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const key = (userId: string) => `gsb-draft:${userId}`;

export interface Draft {
  savedAt: number;
  form: FormState;
}

/** True when the form holds anything worth keeping (a fresh blank bill is not). */
export function hasContent(f: FormState): boolean {
  const c = f.customer;
  return (
    !!(c.phone || c.name || c.gstin || c.pan || c.address) ||
    f.lines.some((l) => l.description.trim() || l.gross || l.less || l.stone || (l.makingValue && l.makingValue !== "0")) ||
    f.exchange.length > 0 ||
    !!(f.discount || f.received || f.notes.trim() || f.payDetails.trim())
  );
}

export function readDraft(userId: string): Draft | null {
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return null;
    const d = JSON.parse(raw) as { v?: number; savedAt?: number; form?: FormState };
    if (d.v !== VERSION || !d.form || !d.savedAt || Date.now() - d.savedAt > MAX_AGE_MS || !Array.isArray(d.form.lines)) {
      localStorage.removeItem(key(userId));
      return null;
    }
    return hasContent(d.form) ? { savedAt: d.savedAt, form: d.form } : null;
  } catch {
    return null;
  }
}

export function writeDraft(userId: string, form: FormState) {
  try {
    if (hasContent(form)) localStorage.setItem(key(userId), JSON.stringify({ v: VERSION, savedAt: Date.now(), form }));
    else localStorage.removeItem(key(userId));
  } catch {
    /* storage full or blocked: autosave is a convenience, never an error */
  }
}

export function clearDraft(userId: string) {
  try {
    localStorage.removeItem(key(userId));
  } catch {
    /* ignore */
  }
}
