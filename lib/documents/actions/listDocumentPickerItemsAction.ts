"use server";

import { requireStaff } from "@/lib/auth/server";
import { listDocumentPickerItems } from "@/lib/documents/public";
import type { ListDocumentPickerItemsResult } from "@/types/document";

export async function listDocumentPickerItemsAction(input: {
  kind: "document";
  search?: string;
  page?: number;
}): Promise<ListDocumentPickerItemsResult> {
  const auth = await requireStaff("articles.*");
  if (!auth.ok) return { ok: false, code: "not_allowed" };
  return listDocumentPickerItems({ search: input.search, page: input.page });
}
