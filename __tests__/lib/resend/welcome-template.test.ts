import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/config", () => ({
  publicConfig: { appUrl: "https://test.ceylonsafety.com" },
  serverConfig: {},
}));

describe("renderWelcomeEmail (AC2)", () => {
  let renderWelcomeEmail: () => { subject: string; html: string };

  beforeEach(async () => {
    vi.resetModules();
    ({ renderWelcomeEmail } = await import(
      "@/lib/resend/templates/welcome"
    ));
  });

  it("returns a non-empty subject string", () => {
    const { subject } = renderWelcomeEmail();
    expect(subject).toBeTruthy();
    expect(typeof subject).toBe("string");
  });

  it("includes the app URL in the html (AC2: branded CTA link)", () => {
    const { html } = renderWelcomeEmail();
    expect(html).toContain("https://test.ceylonsafety.com");
  });

  it("includes the brand name in the html (AC2: branded email)", () => {
    const { html } = renderWelcomeEmail();
    expect(html).toContain("Ceylon Safety");
  });

  it("returns valid HTML (has doctype and body)", () => {
    const { html } = renderWelcomeEmail();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
  });
});
