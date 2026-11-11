import "server-only";

import crypto from "crypto";
import { centsToDecimal } from "./money";
import type { PayHereConfig } from "./types";
import type { PayHereFormFields } from "@/types/payhere";

export interface PayHereOrderInput {
  orderNumber: string;
  totalCents: number;
}

export interface PayHereBillingInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
}

export interface PayHereUrlsInput {
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
}

function md5(s: string): string {
  return crypto.createHash("md5").update(s).digest("hex");
}

// Standard PayHere hash formula (design section 5.1):
// md5(merchantId + orderId + amount + currency + strtoupper(md5(secret)))
function buildHash(
  merchantId: string,
  orderId: string,
  amount: string,
  currency: string,
  secret: string,
): string {
  const secretHash = md5(secret).toUpperCase();
  return md5(merchantId + orderId + amount + currency + secretHash);
}

export function buildPayHereRequest(
  order: PayHereOrderInput,
  billing: PayHereBillingInput,
  urls: PayHereUrlsInput,
  config: PayHereConfig,
): PayHereFormFields {
  const amount = centsToDecimal(order.totalCents);
  const currency = "LKR";
  const hash = buildHash(config.merchantId, order.orderNumber, amount, currency, config.secret);

  return {
    checkout_url: config.checkoutUrl,
    merchant_id: config.merchantId,
    return_url: urls.returnUrl,
    cancel_url: urls.cancelUrl,
    notify_url: urls.notifyUrl,
    order_id: order.orderNumber,
    items: "CeylonSafety documents",
    currency,
    amount,
    first_name: billing.firstName,
    last_name: billing.lastName,
    email: billing.email,
    phone: billing.phone,
    address: billing.address,
    city: billing.city,
    country: "LK",
    hash,
  };
}
