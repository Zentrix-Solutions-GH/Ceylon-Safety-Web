// S-092: PayHereRedirect — AC6 auto-submit
import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import React from "react";

vi.mock("@/messages/en", () => ({
  t: (key: string) => key,
}));

import PayHereRedirect from "@/components/checkout/PayHereRedirect";
import type { PayHereFormFields } from "@/types/payhere";

const FAKE_FIELDS: PayHereFormFields = {
  checkout_url: "https://sandbox.payhere.lk/pay/checkout",
  merchant_id: "1234",
  return_url: "https://example.com/checkout/success?order=o1",
  cancel_url: "https://example.com/checkout/cancel?order=o1",
  notify_url: "https://example.com/api/payhere/notify",
  order_id: "CS-2026-00001",
  items: "CeylonSafety documents (1 item)",
  currency: "LKR",
  amount: "1499.00",
  first_name: "Kasun",
  last_name: "Silva",
  email: "k@test.com",
  phone: "0771234567",
  address: "123 Main St",
  city: "Colombo",
  country: "LK",
  hash: "abc123",
};

describe("PayHereRedirect", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a hidden form with PayHere fields", () => {
    const { container } = render(React.createElement(PayHereRedirect, { fields: FAKE_FIELDS }));
    const form = container.querySelector("form");
    expect(form).not.toBeNull();

    // All required fields present as hidden inputs
    const merchantInput = container.querySelector('input[name="merchant_id"]');
    expect(merchantInput).not.toBeNull();
    expect(merchantInput?.getAttribute("value")).toBe("1234");

    const amountInput = container.querySelector('input[name="amount"]');
    expect(amountInput?.getAttribute("value")).toBe("1499.00");
  });

  it("auto-submits the form via useEffect", async () => {
    const submitSpy = vi.fn();
    // We need to intercept form.submit() — override HTMLFormElement.prototype.submit
    const originalSubmit = HTMLFormElement.prototype.submit;
    HTMLFormElement.prototype.submit = submitSpy;

    render(React.createElement(PayHereRedirect, { fields: FAKE_FIELDS }));

    // submit should be called (via useEffect after mount)
    await vi.waitFor(() => {
      expect(submitSpy).toHaveBeenCalled();
    });

    HTMLFormElement.prototype.submit = originalSubmit;
  });

  it("form action points to PayHere checkout URL and uses POST", () => {
    const { container } = render(React.createElement(PayHereRedirect, { fields: FAKE_FIELDS }));
    const form = container.querySelector("form");
    expect(form?.getAttribute("action")).toBe(FAKE_FIELDS.checkout_url);
    expect(form?.getAttribute("method")).toBe("POST");
  });
});
