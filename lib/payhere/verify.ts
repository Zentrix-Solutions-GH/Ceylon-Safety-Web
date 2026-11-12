import "server-only";

import crypto from "crypto";

export interface NotifyFields {
  merchant_id: string;
  order_id: string;
  payment_id: string;
  payhere_amount: string;
  payhere_currency: string;
  status_code: string;
  md5sig: string;
  payment_description: string;
}

// PayHere notify signature (commerce design section 19 item 2):
// md5( merchant_id + order_id + payhere_amount + payhere_currency + status_code + strtoupper(md5(secret)) )
function computeExpected(fields: NotifyFields, secret: string): Buffer {
  const secretHash = crypto.createHash("md5").update(secret).digest("hex").toUpperCase();
  const expected = crypto
    .createHash("md5")
    .update(
      fields.merchant_id +
        fields.order_id +
        fields.payhere_amount +
        fields.payhere_currency +
        fields.status_code +
        secretHash
    )
    .digest("hex");
  return Buffer.from(expected, "utf8");
}

export function verifyNotifySignature(fields: NotifyFields, secret: string): boolean {
  const received = Buffer.from(fields.md5sig ?? "", "utf8");
  const expected = computeExpected(fields, secret);
  if (received.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(received, expected);
  } catch {
    return false;
  }
}

export function parseNotifyBody(raw: string): NotifyFields {
  if (!raw || raw.trim() === "") {
    throw new Error("parseNotifyBody: empty body");
  }
  const params = new URLSearchParams(raw);
  return {
    merchant_id: params.get("merchant_id") ?? "",
    order_id: params.get("order_id") ?? "",
    payment_id: params.get("payment_id") ?? "",
    payhere_amount: params.get("payhere_amount") ?? "",
    payhere_currency: params.get("payhere_currency") ?? "",
    status_code: params.get("status_code") ?? "",
    md5sig: params.get("md5sig") ?? "",
    payment_description: params.get("payment_description") ?? "",
  };
}
