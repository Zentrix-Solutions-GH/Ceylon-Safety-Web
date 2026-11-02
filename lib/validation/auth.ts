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

export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1).max(512),
  captchaToken: z.string().min(1),
  next: z.string().max(2048).optional(),
});

export const signOutSchema = z.object({
  scope: z.enum(["this", "all"]),
});

export const startGoogleSignInSchema = z.object({
  next: z.string().max(2048).optional(),
});

// ─── S-036 schemas ────────────────────────────────────────────────────────────

export const requestPasswordResetSchema = z.object({
  email: emailField,
  captchaToken: z.string().min(1),
});

export const resetPasswordSchema = z.object({
  email: emailField,
  code: z.string().trim().min(1),
  newPassword: passwordField,
  authenticatorCode: z.string().trim().optional(),
});

export const changePasswordSchema = z.object({
  code: z.string().trim().min(1),
  newPassword: passwordField,
});

export const requestReverificationSchema = z.object({
  captchaToken: z.string().min(1),
});

export const confirmReverificationSchema = z.object({
  code: z.string().trim().min(1),
  authenticatorCode: z.string().trim().optional(),
});

export type SignUpFormValues = z.infer<typeof signUpSchema>;
export type VerifyEmailFormValues = z.infer<typeof verifyEmailSchema>;
export type ResendCodeFormValues = z.infer<typeof resendCodeSchema>;
