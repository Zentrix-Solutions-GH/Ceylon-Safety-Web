"use server";

import { requireStaff } from "@/lib/auth/server";
import { listDocumentPickerItems } from "@/lib/documents/public";
import { listDocumentPickerSchema } from "@/lib/validation/document";
import type { ListDocumentPickerItemsResult } from "@/types/document";

export async function listDocumentPickerItemsAction(input: {
  search?: string;
  page?: number;
}): Promise<ListDocumentPickerItemsResult> {
  const parsed = listDocumentPickerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "unknown" };

  const auth = await requireStaff("articles.*");
  if (!auth.ok) return { ok: false, code: "not_allowed" };
  return listDocumentPickerItems({ search: parsed.data.search, page: parsed.data.page });
}
