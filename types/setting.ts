// S-099: Settings types — groups, per-group value shapes, save result.

export type SettingGroup =
  | "site"
  | "contact"
  | "business"
  | "analytics";

// Per-group value shapes (all fields optional — only send what changed).

export interface SiteGroupValues {
  counters_min_visible?: number | null;
  counters_rounding?: number | null;
  bulk_contact_note?: string | null;
  bulk_contact_phone?: string | null;
  footer_business_name?: string | null;
  footer_registration_no?: string | null;
}

export interface ContactGroupValues {
  whatsapp_number?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  footer_address?: string | null;
  social_facebook?: string | null;
  social_instagram?: string | null;
  social_linkedin?: string | null;
  social_youtube?: string | null;
}

export interface BusinessGroupValues {
  business_legal_name?: string | null;
  business_registration_no?: string | null;
  tax_registration_no?: string | null;
  business_address?: string | null;
  bank_account_details?: string | null;
  owner_alert_email?: string | null;
}

export interface AnalyticsGroupValues {
  analytics_measurement_id?: string | null;
}

export type SettingsGroupValues =
  | { group: "site"; values: SiteGroupValues }
  | { group: "contact"; values: ContactGroupValues }
  | { group: "business"; values: BusinessGroupValues }
  | { group: "analytics"; values: AnalyticsGroupValues };

export type SaveSettingsResult =
  | { ok: true }
  | { ok: false; code: "not_allowed" }
  | { ok: false; code: "mfa_required" }
  | { ok: false; code: "version_conflict" }
  | { ok: false; code: "validation_failed"; field?: string; reason?: string };

export interface SaveSettingsGroupParams {
  group: SettingGroup;
  values: Record<string, unknown>;
  updatedAt: string | null;
  code?: string;
}

// Public settings — only is_public=true rows, returned as a flat key→value map.
export type PublicSettings = Record<string, unknown>;
