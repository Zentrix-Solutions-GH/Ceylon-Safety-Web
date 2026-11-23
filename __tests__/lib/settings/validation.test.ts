// S-099: Validation unit tests — AC3, EC4, EC5, analyst-gap: owner_alert_email format, updatedAt null
import { describe, it, expect } from "vitest";
import {
  validateSiteGroup,
  validateContactGroup,
  validateBusinessGroup,
  validateAnalyticsGroup,
} from "@/lib/settings/validation";

describe("validateSiteGroup", () => {
  it("AC3: accepts valid values and returns parsed output", () => {
    const result = validateSiteGroup({
      counters_min_visible: 0,
      counters_rounding: 100,
      bulk_contact_note: "Call us",
      bulk_contact_phone: "+94 77 123 4567",
      footer_business_name: "CeylonSafety",
      footer_registration_no: "PV12345",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.parsed).toMatchObject({ footer_business_name: "CeylonSafety" });
  });

  it("security: unknown keys are stripped from parsed output (cross-group injection defence)", () => {
    const result = validateSiteGroup({
      footer_business_name: "CeylonSafety",
      contact_email: "attacker@evil.com", // contact group key — must be stripped
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.parsed).toHaveProperty("footer_business_name");
      expect(result.parsed).not.toHaveProperty("contact_email");
    }
  });

  it("AC3: footer_business_name over 120 chars is rejected", () => {
    const r = validateSiteGroup({ footer_business_name: "A".repeat(121) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("footer_business_name");
  });

  it("AC3: bulk_contact_note over 300 chars is rejected", () => {
    const r = validateSiteGroup({ bulk_contact_note: "B".repeat(301) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("bulk_contact_note");
  });

  it("AC3: counters_min_visible below 0 is rejected", () => {
    const r = validateSiteGroup({ counters_min_visible: -1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("counters_min_visible");
  });

  it("AC3: counters_rounding must be from the fixed list (100 is valid)", () => {
    const r = validateSiteGroup({ counters_rounding: 100 });
    expect(r.ok).toBe(true);
  });

  it("AC3: counters_rounding not in the fixed list is rejected (e.g. 7)", () => {
    const r = validateSiteGroup({ counters_rounding: 7 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("counters_rounding");
  });

  it("EC5: bulk_contact_phone null is allowed", () => {
    const r = validateSiteGroup({ bulk_contact_phone: null });
    expect(r.ok).toBe(true);
  });

  it("AC3: invalid phone format is rejected", () => {
    const r = validateSiteGroup({ bulk_contact_phone: "not-a-phone" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("bulk_contact_phone");
  });
});

describe("validateContactGroup", () => {
  it("AC3: accepts valid contact values", () => {
    expect(
      validateContactGroup({
        contact_email: "info@ceylonsafety.lk",
        contact_phone: "+94 11 234 5678",
        social_facebook: "https://facebook.com/ceylonsafety",
        social_instagram: "https://instagram.com/ceylonsafety",
        social_linkedin: "https://linkedin.com/company/ceylonsafety",
        social_youtube: "https://youtube.com/@ceylonsafety",
      })
    ).toMatchObject({ ok: true });
  });

  it("AC3: invalid contact_email is rejected", () => {
    const r = validateContactGroup({ contact_email: "not-an-email" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("contact_email");
  });

  it("EC4: wrong host for social_facebook is rejected", () => {
    const r = validateContactGroup({ social_facebook: "https://twitter.com/ceylonsafety" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("social_facebook");
  });

  it("EC4: non-https URL for social_instagram is rejected", () => {
    const r = validateContactGroup({ social_instagram: "http://instagram.com/ceylonsafety" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("social_instagram");
  });

  it("AC3: www. subdomain accepted for social links", () => {
    const r = validateContactGroup({
      social_facebook:  "https://www.facebook.com/ceylonsafety",
      social_instagram: "https://www.instagram.com/ceylonsafety",
      social_linkedin:  "https://www.linkedin.com/company/ceylonsafety",
      social_youtube:   "https://www.youtube.com/@ceylonsafety",
    });
    expect(r.ok).toBe(true);
  });

  it("AC3: null social links are allowed (optional)", () => {
    const r = validateContactGroup({ social_facebook: null, social_youtube: null });
    expect(r.ok).toBe(true);
  });
});

describe("validateBusinessGroup", () => {
  it("AC3: accepts valid business values", () => {
    expect(
      validateBusinessGroup({
        business_legal_name: "CeylonSafety (Pvt) Ltd",
        bank_account_details: "0001234567890",
        owner_alert_email: "owner@ceylonsafety.lk",
      })
    ).toMatchObject({ ok: true });
  });

  it("AC3: business_legal_name over 200 chars is rejected", () => {
    const r = validateBusinessGroup({ business_legal_name: "X".repeat(201) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("business_legal_name");
  });

  it("AC3: bank_account_details with non-digits is rejected", () => {
    const r = validateBusinessGroup({ bank_account_details: "ABC-123" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("bank_account_details");
  });

  it("AC3: bank_account_details empty string is rejected (all parts must be filled)", () => {
    const r = validateBusinessGroup({ bank_account_details: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("bank_account_details");
  });

  it("analyst-gap: owner_alert_email must be a valid email", () => {
    const r = validateBusinessGroup({ owner_alert_email: "not-email" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("owner_alert_email");
  });

  it("analyst-gap: owner_alert_email null is allowed", () => {
    const r = validateBusinessGroup({ owner_alert_email: null });
    expect(r.ok).toBe(true);
  });
});

describe("validateAnalyticsGroup", () => {
  it("AC3: accepts valid G- measurement id", () => {
    const r = validateAnalyticsGroup({ analytics_measurement_id: "G-ABCDEF1234" });
    expect(r.ok).toBe(true);
  });

  it("AC3: measurement id not starting with G- is rejected", () => {
    const r = validateAnalyticsGroup({ analytics_measurement_id: "UA-12345" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("analytics_measurement_id");
  });

  it("AC3: null measurement id is allowed", () => {
    const r = validateAnalyticsGroup({ analytics_measurement_id: null });
    expect(r.ok).toBe(true);
  });
});
