import { z } from "zod";

export const documentLanguageSchema = z.enum(["en", "si", "ta"]);

export const documentIdSchema = z.string().uuid();

export const buyNowSchema = z.object({
  documentId: z.string().uuid(),
  language: documentLanguageSchema,
});

export const cartCalculateBodySchema = z.object({
  buyNow: buyNowSchema.optional(),
});
