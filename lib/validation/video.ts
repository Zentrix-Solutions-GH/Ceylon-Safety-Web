import { z } from "zod";

export const addVideoSchema = z.object({
  youtubeLink: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  categoryId: z.string().uuid(),
  customThumbnailMediaId: z.string().uuid().nullable().optional(),
});

export const updateVideoSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  categoryId: z.string().uuid().optional(),
  customThumbnailMediaId: z.string().uuid().nullable().optional(),
  updatedAt: z.string().datetime(),
});

export const setVideoStatusSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["publish", "hide", "unhide", "delete"]),
  publishedAt: z.string().datetime().nullable().optional(),
  updatedAt: z.string().datetime(),
});

export const listPickerItemsSchema = z.object({
  kind: z.literal("video"),
  search: z.string().max(100).optional(),
  page: z.number().int().min(1).optional(),
});

export const listAdminVideosSchema = z.object({
  status: z.enum(["draft", "published", "hidden", "scheduled"]).optional(),
  page: z.number().int().min(1).optional(),
});
