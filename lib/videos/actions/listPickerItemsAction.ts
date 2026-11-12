"use server";

import { requireStaff } from "@/lib/auth/server";
import { listPickerItems } from "./listPickerItems";
import type { ListPickerItemsInput, ListPickerItemsResult } from "@/types/video";

export async function listPickerItemsAction(input: ListPickerItemsInput): Promise<ListPickerItemsResult> {
  const auth = await requireStaff("articles.*");
  if (!auth.ok) return { ok: false, code: "not_allowed" };
  return listPickerItems(input);
}
