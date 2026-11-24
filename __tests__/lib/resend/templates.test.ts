// S-088: AC1–AC6 — email template rendering

import { describe, it, expect } from "vitest";

// ─── slip-rejected (AC1) ─────────────────────────────────────────────────────
import { renderBankRejectedEmail } from "@/lib/resend/templates/bank-rejected";

describe("renderBankRejectedEmail (AC1)", () => {
  const data = {
    reason: "Blurry image, cannot read account number",
    orderPageUrl: "https://ceylonsafety.lk/orders/ord-123",
    supportEmail: "support@ceylonsafety.lk",
  };

  it("includes admin reason in html", () => {
    const { html } = renderBankRejectedEmail(data);
    expect(html).toContain("Blurry image");
  });

  it("includes order page URL in html", () => {
    const { html } = renderBankRejectedEmail(data);
    expect(html).toContain("https://ceylonsafety.lk/orders/ord-123");
  });

  it("includes support email in html", () => {
    const { html } = renderBankRejectedEmail(data);
    expect(html).toContain("support@ceylonsafety.lk");
  });

  it("includes reason in text", () => {
    const { text } = renderBankRejectedEmail(data);
    expect(text).toContain("Blurry image");
  });

  it("subject is set", () => {
    const { subject } = renderBankRejectedEmail(data);
    expect(subject.length).toBeGreaterThan(0);
  });
});

// ─── bank-order-expiring (AC2) ───────────────────────────────────────────────
import { renderBankExpiringEmail } from "@/lib/resend/templates/bank-expiring";

describe("renderBankExpiringEmail (AC2)", () => {
  const data = {
    orderNumber: "CS-2026-0042",
    expiryDate: "2026-11-30T00:00:00Z",
    appUrl: "https://ceylonsafety.lk",
  };

  it("includes order number in html", () => {
    const { html } = renderBankExpiringEmail(data);
    expect(html).toContain("CS-2026-0042");
  });

  it("includes expiry date formatted in Asia/Colombo in html", () => {
    const { html } = renderBankExpiringEmail(data);
    // 2026-11-30T00:00:00Z = 05:30 on 30 Nov 2026 in Asia/Colombo → "30 November 2026"
    expect(html).toContain("30 November 2026");
  });

  it("includes text part", () => {
    const { text } = renderBankExpiringEmail(data);
    expect(text).toContain("CS-2026-0042");
  });
});

// ─── download-request-approved (AC3) ────────────────────────────────────────
import { renderDownloadApprovedEmail } from "@/lib/resend/templates/download-request-approved";

describe("renderDownloadApprovedEmail (AC3)", () => {
  const data = {
    downloadUrl: "https://ceylonsafety.lk/download/oi-uuid-1",
    appUrl: "https://ceylonsafety.lk",
    supportEmail: "support@ceylonsafety.lk",
  };

  it("includes direct download URL in html", () => {
    const { html } = renderDownloadApprovedEmail(data);
    expect(html).toContain("https://ceylonsafety.lk/download/oi-uuid-1");
  });

  it("states link works once in html", () => {
    const { html } = renderDownloadApprovedEmail(data);
    expect(html.toLowerCase()).toContain("once");
  });

  it("includes text part with download URL", () => {
    const { text } = renderDownloadApprovedEmail(data);
    expect(text).toContain("https://ceylonsafety.lk/download/oi-uuid-1");
  });
});

// ─── download-request-rejected (AC4) ────────────────────────────────────────
import { renderDownloadRejectedEmail } from "@/lib/resend/templates/download-request-rejected";

describe("renderDownloadRejectedEmail (AC4)", () => {
  const data = {
    adminNote: "Cannot grant additional downloads at this time",
    supportEmail: "support@ceylonsafety.lk",
  };

  it("includes admin note in html", () => {
    const { html } = renderDownloadRejectedEmail(data);
    expect(html).toContain("Cannot grant additional downloads");
  });

  it("includes support email in html", () => {
    const { html } = renderDownloadRejectedEmail(data);
    expect(html).toContain("support@ceylonsafety.lk");
  });

  it("includes text part", () => {
    const { text } = renderDownloadRejectedEmail(data);
    expect(text).toContain("Cannot grant additional downloads");
  });
});

// ─── idle-deletion-warning (AC5) ────────────────────────────────────────────
import { renderIdleDeletionWarningEmail } from "@/lib/resend/templates/idle-deletion-warning";

describe("renderIdleDeletionWarningEmail (AC5)", () => {
  const data = {
    ownerEmail: "owner@example.com",
    deletionDate: "2027-01-15T00:00:00Z",
    appUrl: "https://ceylonsafety.lk",
  };

  it("includes deletion date formatted in Asia/Colombo in html", () => {
    const { html } = renderIdleDeletionWarningEmail(data);
    // 2027-01-15T00:00:00Z = 05:30 on 15 Jan 2027 in Asia/Colombo → "15 January 2027"
    expect(html).toContain("15 January 2027");
  });

  it("includes sign-in link in html", () => {
    const { html } = renderIdleDeletionWarningEmail(data);
    expect(html).toContain("ceylonsafety.lk");
  });

  it("includes text part", () => {
    const { text } = renderIdleDeletionWarningEmail(data);
    expect(text.length).toBeGreaterThan(0);
  });

  it("renders ownerEmail in html body (AC5)", () => {
    const { html } = renderIdleDeletionWarningEmail(data);
    expect(html).toContain("owner@example.com");
  });

  it("renders ownerEmail in text body (AC5)", () => {
    const { text } = renderIdleDeletionWarningEmail(data);
    expect(text).toContain("owner@example.com");
  });
});

// ─── account-deletion-otp stub (AC6) ─────────────────────────────────────────
import { renderAccountDeletionOtpEmail } from "@/lib/resend/templates/account-deletion-otp";

describe("renderAccountDeletionOtpEmail (AC6)", () => {
  const data = {
    otp: "847291",
    appUrl: "https://ceylonsafety.lk",
  };

  it("includes 6-digit OTP in html", () => {
    const { html } = renderAccountDeletionOtpEmail(data);
    expect(html).toContain("847291");
  });

  it("includes text part with OTP", () => {
    const { text } = renderAccountDeletionOtpEmail(data);
    expect(text).toContain("847291");
  });
});
