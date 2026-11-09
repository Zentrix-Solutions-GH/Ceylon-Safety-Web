// S-052: Zod validation schemas for author actions.

import { z } from "zod";

export const saveAuthorSchema = z.object({
  id: z.string().uuid().optional(),
  name: z
    .string()
    .min(1, "name required")
    .max(100, "name too long")
    .transform((v) => v.trim())
    .refine((v) => v.length > 0, { message: "name cannot be blank" }),
  bio: z.string().max(500, "bio too long").nullable().optional(),
  updatedAt: z.string().datetime().optional(),
});

export const setAuthorActiveSchema = z.object({
  id: z.string().uuid(),
  active: z.boolean(),
  updatedAt: z.string().datetime(),
});
