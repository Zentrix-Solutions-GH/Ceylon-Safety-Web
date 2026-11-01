// Shared Zod schemas for auth actions (S-034).
// Consumed by server actions (lib/auth/actions/) and forms (S-041).

import { z } from "zod";

const nameField = z
  .string()
  .trim()
  .min(1, "required")
  .max(50, "too_long");

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .email("invalid_email");

const passwordField = z
  .string()
  .min(8, "too_short");

export const signUpSchema = z.object({
  firstName: nameField,
  lastName: nameField,
  email: emailField,
  password: passwordField,
  termsAccepted: z.literal(true, { error: "required" }),
  captchaToken: z.string().min(1),
  next: z.string().optional(),
});

export const verifyEmailSchema = z.object({
  email: emailField,
  code: z.string().trim().min(1),
});

export const resendCodeSchema = z.object({
  email: emailField,
  captchaToken: z.string().min(1),
});

export type SignUpFormValues = z.infer<typeof signUpSchema>;
export type VerifyEmailFormValues = z.infer<typeof verifyEmailSchema>;
export type ResendCodeFormValues = z.infer<typeof resendCodeSchema>;
