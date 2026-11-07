// S-050: Zod schemas for comment and like routes.

import { z } from "zod";

export const commentKindSchema = z.enum(["article"], {
  error: "Only 'article' is supported in Release 1",
});

// Module-level constants to avoid re-construction on every cursor parse.
const isoDatetimeSchema = z.string().datetime();
const uuidSchema = z.string().uuid();

// Cursor is an opaque (createdAt ISO string, id UUID) pair
export const commentCursorSchema = z
  .string()
  .refine(
    (val) => {
      try {
        const obj = JSON.parse(Buffer.from(val, "base64url").toString("utf8"));
        return (
          typeof obj === "object" &&
          obj !== null &&
          isoDatetimeSchema.safeParse(obj.createdAt).success &&
          uuidSchema.safeParse(obj.id).success
        );
      } catch {
        return false;
      }
    },
    { message: "invalid cursor" }
  )
  .optional();

export const postCommentBodySchema = z.object({
  kind: commentKindSchema,
  id: z.string().uuid(),
  text: z.string().min(1, "text required").max(2000, "text too long"),
});

export const likeBodySchema = z.object({
  kind: commentKindSchema,
  id: z.string().uuid(),
});

export const likeQuerySchema = z.object({
  kind: commentKindSchema,
  id: z.string().uuid(),
});

export const commentsQuerySchema = z.object({
  kind: commentKindSchema,
  id: z.string().uuid(),
  cursor: commentCursorSchema,
  mine: z.string().optional(),
});

export type CommentCursorParsed = { createdAt: string; id: string };

export function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt, id })).toString("base64url");
}

export function decodeCursor(cursor: string): CommentCursorParsed {
  return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as CommentCursorParsed;
}
