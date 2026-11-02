// Shared Zod schemas for user profile actions (S-037).
// Consumed by server actions (lib/auth/actions/).

import { z } from "zod";

const nameField = z.string().trim().min(1, "required").max(50, "too_long");

const billingAddressSchema = z.object({
  line1: z.string().trim().min(1, "required").max(200, "too_long"),
  line2: z.string().trim().max(200, "too_long").optional(),
  city: z.string().trim().min(1, "required").max(100, "too_long"),
  state: z.string().trim().max(100, "too_long").optional(),
  postalCode: z.string().trim().max(20, "too_long").optional(),
  country: z.string().trim().min(1, "required").max(100, "too_long"),
});

export const updateProfileSchema = z.object({
  firstName: nameField.optional(),
  lastName: nameField.optional(),
  displayName: z.string().trim().min(2, "too_short").max(40, "too_long").optional(),
  phone: z.string().trim().max(30, "too_long").optional().or(z.literal("")),
  companyName: z.string().trim().max(120, "too_long").optional().or(z.literal("")),
  taxId: z.string().trim().max(50, "too_long").optional().or(z.literal("")),
  billingAddress: billingAddressSchema.optional().nullable(),
});

export const deleteAccountSchema = z.object({
  code: z.string().trim().min(1),
  authenticatorCode: z.string().trim().optional(),
});
