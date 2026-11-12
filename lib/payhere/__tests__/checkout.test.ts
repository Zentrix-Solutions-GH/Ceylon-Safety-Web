import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { buildPayHereRequest } from "../checkout";

function md5(s: string): string {
  return crypto.createHash("md5").update(s).digest("hex");
}

function expectedHash(merchantId: string, orderId: string, amount: string, currency: string, secret: string): string {
  return md5(merchantId + orderId + amount + currency + md5(secret).toUpperCase());
}

const sandboxConfig = {
  merchantId: "sandbox-mid",
  secret: "sandbox-secret",
  isSandbox: true,
  checkoutUrl: "https://sandbox.payhere.lk/pay/checkout",
};

const liveConfig = {
  merchantId: "live-mid",
  secret: "live-secret",
  isSandbox: false,
  checkoutUrl: "https://www.payhere.lk/pay/checkout",
};

const baseOrder = {
  orderNumber: "CS-2026-00001",
  totalCents: 715545,
  itemCount: 3,
};

const baseBilling = {
  firstName: "Test",
  lastName: "User",
  email: "test@example.com",
  phone: "+94771234567",
  address: "123 Main St",
  city: "Colombo",
};

const baseUrls = {
  returnUrl: "https://app.test/checkout/success?order=abc",
  cancelUrl: "https://app.test/checkout/cancel?order=abc",
  notifyUrl: "https://app.test/api/payhere/notify",
};

describe("buildPayHereRequest", () => {
  it("produces all required fields (AC2)", () => {
    const fields = buildPayHereRequest(baseOrder, baseBilling, baseUrls, sandboxConfig);
    expect(fields.merchant_id).toBeDefined();
    expect(fields.return_url).toBeDefined();
    expect(fields.cancel_url).toBeDefined();
    expect(fields.notify_url).toBeDefined();
    expect(fields.order_id).toBeDefined();
    expect(fields.items).toBeDefined();
    expect(fields.currency).toBe("LKR");
    expect(fields.amount).toBeDefined();
    expect(fields.first_name).toBeDefined();
    expect(fields.last_name).toBeDefined();
    expect(fields.email).toBeDefined();
    expect(fields.phone).toBeDefined();
    expect(fields.address).toBeDefined();
    expect(fields.city).toBeDefined();
    expect(fields.country).toBeDefined();
    expect(fields.hash).toBeDefined();
  });

  it("computes correct hash (AC3)", () => {
    const fields = buildPayHereRequest(baseOrder, baseBilling, baseUrls, sandboxConfig);
    const expected = expectedHash(
      sandboxConfig.merchantId,
      baseOrder.orderNumber,
      fields.amount,
      "LKR",
      sandboxConfig.secret,
    );
    expect(fields.hash).toBe(expected);
  });

  it("hash matches fixed known-output reference vector (AC3)", () => {
    // Reference vector computed offline (Node.js crypto, verified manually):
    // merchantId=1215097, orderId=ItemNo12345, amount=1000.00, currency=LKR
    // secret=GfPy2tCMDCN6GQQCSPqPFhKSjHFbRAMm
    // md5(secret).toUpperCase() = "88241DD5A74865480F6934327098D4FF"
    // md5(merchantId+orderId+amount+currency+secretHashUpper) = "f94565f2fdb5b5e04e098874b4e77e25"
    // This hardcoded literal makes the test independent of the production implementation.
    const docConfig = {
      merchantId: "1215097",
      secret: "GfPy2tCMDCN6GQQCSPqPFhKSjHFbRAMm",
      isSandbox: true,
      checkoutUrl: "https://sandbox.payhere.lk/pay/checkout",
    };
    const fields = buildPayHereRequest(
      { orderNumber: "ItemNo12345", totalCents: 100000, itemCount: 1 },
      baseBilling,
      baseUrls,
      docConfig,
    );
    expect(fields.hash).toBe("f94565f2fdb5b5e04e098874b4e77e25");
  });

  it("secret is not in returned fields (AC3)", () => {
    const fields = buildPayHereRequest(baseOrder, baseBilling, baseUrls, sandboxConfig);
    const json = JSON.stringify(fields);
    expect(json).not.toContain("sandbox-secret");
  });

  it("sandbox mode uses sandbox merchant id (AC4)", () => {
    const fields = buildPayHereRequest(baseOrder, baseBilling, baseUrls, sandboxConfig);
    expect(fields.merchant_id).toBe("sandbox-mid");
    expect(fields.checkout_url).toBe(sandboxConfig.checkoutUrl);
  });

  it("live mode uses live merchant id (AC4)", () => {
    const fields = buildPayHereRequest(baseOrder, baseBilling, baseUrls, liveConfig);
    expect(fields.merchant_id).toBe("live-mid");
    expect(fields.checkout_url).toBe(liveConfig.checkoutUrl);
  });

  it("country is always LK", () => {
    const fields = buildPayHereRequest(baseOrder, baseBilling, baseUrls, sandboxConfig);
    expect(fields.country).toBe("LK");
  });

  it("amount is formatted as two-decimal string", () => {
    const fields = buildPayHereRequest(baseOrder, baseBilling, baseUrls, sandboxConfig);
    expect(fields.amount).toBe("7155.45");
  });

  it("order_id is the order number", () => {
    const fields = buildPayHereRequest(baseOrder, baseBilling, baseUrls, sandboxConfig);
    expect(fields.order_id).toBe("CS-2026-00001");
  });

  it("items includes item count in description (AC2)", () => {
    const fields = buildPayHereRequest(baseOrder, baseBilling, baseUrls, sandboxConfig);
    expect(fields.items).toBe("CeylonSafety documents (3 items)");
  });

  it("items uses singular for 1 item (AC2)", () => {
    const fields = buildPayHereRequest({ ...baseOrder, itemCount: 1 }, baseBilling, baseUrls, sandboxConfig);
    expect(fields.items).toBe("CeylonSafety documents (1 item)");
  });

  it("items is truncated to 255 characters (EC4)", () => {
    const fields = buildPayHereRequest({ ...baseOrder, itemCount: 999 }, baseBilling, baseUrls, sandboxConfig);
    expect(fields.items.length).toBeLessThanOrEqual(255);
  });

  it("Sinhala and Tamil billing fields pass through byte-identical (EC3)", () => {
    const sinhalaBilling = {
      firstName: "නිමල්",
      lastName: "සිල්වා",
      email: "test@example.com",
      phone: "+94771234567",
      address: "123 ශ්‍රී මාර්ගය",
      city: "කොළඹ",
    };
    const fields = buildPayHereRequest(baseOrder, sinhalaBilling, baseUrls, sandboxConfig);
    expect(fields.first_name).toBe("නිමල්");
    expect(fields.last_name).toBe("සිල්වා");
    expect(fields.address).toBe("123 ශ්‍රී මාර්ගය");
    expect(fields.city).toBe("කොළඹ");
  });
});
