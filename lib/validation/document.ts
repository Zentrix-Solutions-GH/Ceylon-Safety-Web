// Zod validation schemas for document admin actions (S-069).
// Shared between saveDocument and changeDocumentPrice.

import { z } from "zod";

export const DOC_KINDS = ["checklist", "safety_sign", "toolbox_talk"] as const;
export const DOC_LANGUAGES = ["en", "si", "ta"] as const;

export const saveDocumentSchema = z.object({
  documentId: z.string().uuid().optional(),
  title: z
    .string()
    .min(1, "title is required")
    .max(200, "title must be at most 200 characters")
    .transform((v) => v.trim())
    .refine((v) => v.length > 0, { message: "title cannot be blank" }),
  description: z.string().max(2000, "description too long").nullable().optional(),
  docKind: z.enum(DOC_KINDS),
  categoryId: z.string().uuid("invalid category id"),
  pageCount: z.number().int().positive().nullable().optional(),
  previewPages: z.number().int().min(1).max(20).optional(),
  coverImageKey: z.string().max(500).nullable().optional(),
  seoTitle: z.string().max(150).nullable().optional(),
  seoDescription: z.string().max(300).nullable().optional(),
  priceLkr: z
    .number()
    .int("price must be a whole number of LKR")
    .positive("price must be above 0")
    .optional(),
  updatedAt: z.string().optional(),
});

export const changeDocumentPriceSchema = z.object({
  documentId: z.string().uuid(),
  newPriceLkr: z
    .number()
    .int("price must be a whole number of LKR")
    .positive("price must be above 0"),
  confirmedLargeChange: z.boolean().optional().default(false),
  authenticatorCode: z.string().optional(),
});

export type SaveDocumentSchemaInput = z.input<typeof saveDocumentSchema>;
export type ChangeDocumentPriceSchemaInput = z.input<typeof changeDocumentPriceSchema>;
