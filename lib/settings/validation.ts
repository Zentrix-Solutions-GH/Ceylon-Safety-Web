import "server-only";
import { z } from "zod";
import type { SettingGroup } from "@/types/setting";

export type ValidationResult =
  | { ok: true; parsed: Record<string, unknown> }
  | { ok: false; field: string };

// ---------------------------------------------------------------------------
// Phone — international format, digits, spaces, +, -, ()
// Empty string rejected; null allowed by callers.
// ---------------------------------------------------------------------------
const phoneSchema = z
  .string()
  .regex(/^\+?[\d\s\-().]{7,20}$/, "invalid phone format");

// ---------------------------------------------------------------------------
// Social URL — must be https:// and the right host
// ---------------------------------------------------------------------------
function socialUrlSchema(allowedHost: string) {
  return z
    .string()
    .url()
    .refine(
      (val) => {
        try {
          const u = new URL(val);
          return (
            u.protocol === "https:" &&
            (u.hostname === allowedHost || u.hostname === `www.${allowedHost}`)
          );
        } catch {
          return false;
        }
      },
      { message: `URL must be https://${allowedHost}/...` }
    );
}

// ---------------------------------------------------------------------------
// Per-group Zod schemas
// ---------------------------------------------------------------------------

// Q7 (OPEN): exact rounding thresholds are unconfirmed. Using content-design examples
// (0 = show real number, then 10/50/100/500/1000/5000/10000/50000/100000) as the fixed list.
// Update this list when Q7 is answered by the client.
const roundingSchema = z.union([
  z.literal(0), z.literal(10), z.literal(50), z.literal(100), z.literal(500),
  z.literal(1000), z.literal(5000), z.literal(10000), z.literal(50000), z.literal(100000),
]);

const siteSchema = z.object({
  counters_min_visible: z.number().int().min(0).max(100000).nullable().optional(),
  counters_rounding: roundingSchema.nullable().optional(),
  bulk_contact_note: z.string().max(300).nullable().optional(),
  bulk_contact_phone: phoneSchema.nullable().optional(),
  footer_business_name: z.string().max(120).nullable().optional(),
  footer_registration_no: z.string().max(120).nullable().optional(),
});

const contactSchema = z.object({
  whatsapp_number: phoneSchema.nullable().optional(),
  contact_email: z.string().email().nullable().optional(),
  contact_phone: phoneSchema.nullable().optional(),
  footer_address: z.string().max(300).nullable().optional(),
  social_facebook: socialUrlSchema("facebook.com").nullable().optional(),
  social_instagram: socialUrlSchema("instagram.com").nullable().optional(),
  social_linkedin: socialUrlSchema("linkedin.com").nullable().optional(),
  social_youtube: socialUrlSchema("youtube.com").nullable().optional(),
});

const businessSchema = z.object({
  business_legal_name: z.string().max(200).nullable().optional(),
  business_registration_no: z.string().max(200).nullable().optional(),
  tax_registration_no: z.string().max(200).nullable().optional(),
  business_address: z.string().max(200).nullable().optional(),
  // Bank account: non-empty, digits only (AC3: all parts filled, digits only for number)
  bank_account_details: z
    .string()
    .min(1, "bank_account_details cannot be empty")
    .regex(/^\d+$/, "bank account must contain digits only")
    .nullable()
    .optional(),
  owner_alert_email: z.string().email().nullable().optional(),
});

// Analytics measurement id: G- followed by alphanumeric (ASSUMED — format to verify per AC3 note)
const analyticsSchema = z.object({
  analytics_measurement_id: z
    .string()
    .regex(/^G-[A-Z0-9]+$/i, "must start with G- followed by alphanumeric")
    .nullable()
    .optional(),
});

// ---------------------------------------------------------------------------
// Generic parse → first ZodError path as field name
// ---------------------------------------------------------------------------

function parseSchema<T extends z.ZodTypeAny>(
  schema: T,
  values: Record<string, unknown>
): ValidationResult {
  const result = schema.safeParse(values);
  if (result.success) return { ok: true, parsed: result.data as Record<string, unknown> };
  const issue = result.error.issues[0];
  const field = Array.isArray(issue.path) ? String(issue.path[0] ?? "unknown") : "unknown";
  return { ok: false, field };
}

// ---------------------------------------------------------------------------
// Exported per-group validators
// ---------------------------------------------------------------------------

export function validateSiteGroup(values: Record<string, unknown>): ValidationResult {
  return parseSchema(siteSchema, values);
}

export function validateContactGroup(values: Record<string, unknown>): ValidationResult {
  return parseSchema(contactSchema, values);
}

export function validateBusinessGroup(values: Record<string, unknown>): ValidationResult {
  return parseSchema(businessSchema, values);
}

export function validateAnalyticsGroup(values: Record<string, unknown>): ValidationResult {
  return parseSchema(analyticsSchema, values);
}

// ---------------------------------------------------------------------------
// Dispatch by group name (used by saveSettingsGroup)
// ---------------------------------------------------------------------------

export function validateGroup(
  group: SettingGroup,
  values: Record<string, unknown>
): ValidationResult {
  switch (group) {
    case "site":      return validateSiteGroup(values);
    case "contact":   return validateContactGroup(values);
    case "business":  return validateBusinessGroup(values);
    case "analytics": return validateAnalyticsGroup(values);
  }
}
