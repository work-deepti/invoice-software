/** Request-body schemas (shape only; business rules live in calc-engine). */
import { z } from "zod";
import { MAKING_TYPES, METALS, PAY_MODES } from "@/lib/calc-engine";

const num = z.union([z.string().max(32), z.number()]).nullable().optional();
const str = (max = 500) => z.string().max(max).optional().default("");

export const lineSchema = z.object({
  description: str(200),
  purityId: z.string().uuid().nullable().optional(),
  metal: z.enum(METALS),
  purityLabel: str(60),
  hsn: str(8),
  pcs: num,
  gross: num,
  less: num,
  wastagePct: num,
  rate: num,
  rateManual: z.boolean().optional().default(false),
  makingType: z.enum(MAKING_TYPES),
  makingValue: num,
  stone: num,
});

export const exchangeSchema = z.object({
  description: str(200),
  metal: z.enum(METALS),
  weight: num,
  touchPct: num,
  fineRate: num,
});

export const invoiceBodySchema = z.object({
  date: z.string().max(10),
  payMode: z.enum(PAY_MODES),
  payDetails: str(120),
  gstOn: z.boolean(),
  interState: z.boolean().optional().default(false),
  customer: z
    .object({
      phone: str(20),
      name: str(120),
      gstin: str(20),
      pan: str(20),
      state: str(60),
      address: str(500),
      panDeclaration: z.boolean().optional().default(false),
    })
    .optional()
    .default({ phone: "", name: "", gstin: "", pan: "", state: "", address: "", panDeclaration: false }),
  lines: z.array(lineSchema).max(200),
  exchange: z.array(exchangeSchema).max(50).optional().default([]),
  discount: num,
  received: num,
  notes: str(2000),
  acceptWarnings: z.boolean().optional().default(false),
});
export type InvoiceBody = z.infer<typeof invoiceBodySchema>;

export const settingsBodySchema = z.object({
  name: z.string().max(120),
  phone: z.string().max(20),
  email: z.string().max(120),
  gstin: z.string().max(20),
  state: z.string().max(60),
  stateCode: z.string().max(4),
  address: z.string().max(500),
  gstRate: z.union([z.string().max(10), z.number()]),
  gstDefault: z.boolean(),
  prefixGst: z.string().max(20),
  prefixNoGst: z.string().max(20),
  noGstTitle: z.string().max(40),
  hsnGold: z.string().max(10),
  hsnSilver: z.string().max(10),
  fyNumbering: z.boolean(),
  terms: z.string().max(2000),
  bankDetails: z.string().max(1000),
  signatoryLabel: z.string().max(60),
  staffCanSeeDashboard: z.boolean(),
  cashLimit: z.union([z.string().max(20), z.number()]).optional(),
  panLimit: z.union([z.string().max(20), z.number()]).optional(),
  cashPayoutLimit: z.union([z.string().max(20), z.number()]).optional(),
  panMissingPolicy: z.enum(["block", "warn"]).optional(),
});

export const ratesBodySchema = z.object({
  rows: z
    .array(
      z.object({
        id: z.string().uuid().nullable().optional(),
        metal: z.enum(METALS),
        label: z.string().max(60),
        purityPct: num,
        rate: num,
      }),
    )
    .max(50),
  acceptWarnings: z.boolean().optional().default(false),
});

export const cancelBodySchema = z.object({ reason: z.string().trim().min(1, "Enter a reason.").max(300) });

export const loginBodySchema = z.object({ login: z.string().trim().min(1).max(60), password: z.string().min(1).max(200) });

export const newUserSchema = z.object({
  name: z.string().trim().min(1).max(80),
  login: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,40}$/, "Login: 3–40 letters, numbers, dot, dash or underscore."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(200),
  role: z.enum(["owner", "staff", "viewer"]),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  role: z.enum(["owner", "staff", "viewer"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8, "Password must be at least 8 characters.").max(200).optional(),
});
