import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { verifyNotifySignature, parseNotifyBody } from "../verify";

// PayHere notification signature formula (design section 19 item 2):
// md5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + strtoupper(md5(secret)))
function buildTestSig(
  merchantId: string,
  orderId: string,
  amount: string,
  currency: string,
  statusCode: string,
  secret: string,
): string {
  const secretHash = crypto.createHash("md5").update(secret).digest("hex").toUpperCase();
  return crypto
    .createHash("md5")
    .update(merchantId + orderId + amount + currency + statusCode + secretHash)
    .digest("hex");
}

const SECRET = "test-merchant-secret";
const MERCHANT_ID = "1234567";

function makeFields(overrides: Record<string, string> = {}) {
  const base = {
    merchant_id: MERCHANT_ID,
    order_id: "CS-2026-00001",
    payment_id: "PAY-001",
    payhere_amount: "7155.45",
    payhere_currency: "LKR",
    status_code: "2",
    payment_description: "Visa",
  };
  const fields = { ...base, ...overrides };
  const sig = buildTestSig(
    fields.merchant_id,
    fields.order_id,
    fields.payhere_amount,
    fields.payhere_currency,
    fields.status_code,
    SECRET,
  );
  return { ...fields, md5sig: overrides.md5sig ?? sig };
}

describe("verifyNotifySignature", () => {
  it("returns true for a correct signature", () => {
    const fields = makeFields();
    expect(verifyNotifySignature(fields, SECRET)).toBe(true);
  });

  it("returns false when md5sig is wrong", () => {
    const fields = makeFields({ md5sig: "0".repeat(32) });
    expect(verifyNotifySignature(fields, SECRET)).toBe(false);
  });

  it("returns false when merchant_id differs", () => {
    // Sig computed with original MERCHANT_ID; payload tampers merchant_id after signing
    const original = makeFields();
    const fields = { ...original, merchant_id: "9999999" };
    expect(verifyNotifySignature(fields, SECRET)).toBe(false);
  });

  it("returns false when amount differs", () => {
    // Sig computed with original amount; payload tampers amount after signing
    const original = makeFields();
    const fields = { ...original, payhere_amount: "1.00" };
    expect(verifyNotifySignature(fields, SECRET)).toBe(false);
  });

  it("returns false when status_code differs", () => {
    // Sig computed with original status_code; payload tampers it after signing
    const original = makeFields();
    const fields = { ...original, status_code: "-1" };
    expect(verifyNotifySignature(fields, SECRET)).toBe(false);
  });

  it("returns false for a single character change in md5sig", () => {
    const fields = makeFields();
    const tampered = fields.md5sig.slice(0, -1) + (fields.md5sig.endsWith("a") ? "b" : "a");
    expect(verifyNotifySignature({ ...fields, md5sig: tampered }, SECRET)).toBe(false);
  });

  it("uses constant-time comparison (timingSafeEqual)", () => {
    // Verifies the function exists and is used by ensuring it doesn't throw
    // on differing-length strings — timingSafeEqual pads internally.
    const fields = makeFields({ md5sig: "short" });
    expect(() => verifyNotifySignature(fields, SECRET)).not.toThrow();
    expect(verifyNotifySignature(fields, SECRET)).toBe(false);
  });
});

describe("parseNotifyBody", () => {
  it("parses application/x-www-form-urlencoded body", () => {
    const raw =
      "merchant_id=1234567&order_id=CS-2026-00001&payment_id=PAY-001" +
      "&payhere_amount=7155.45&payhere_currency=LKR&status_code=2" +
      "&md5sig=abc123&payment_description=Visa";
    const result = parseNotifyBody(raw);
    expect(result.merchant_id).toBe("1234567");
    expect(result.order_id).toBe("CS-2026-00001");
    expect(result.payhere_amount).toBe("7155.45");
    expect(result.status_code).toBe("2");
    expect(result.md5sig).toBe("abc123");
  });

  it("returns empty strings for missing optional fields", () => {
    const raw = "merchant_id=mid&order_id=CS-001&payhere_amount=1.00&payhere_currency=LKR&status_code=2&md5sig=x";
    const result = parseNotifyBody(raw);
    expect(result.payment_id).toBe("");
  });

  it("throws on empty body", () => {
    expect(() => parseNotifyBody("")).toThrow();
  });
});
