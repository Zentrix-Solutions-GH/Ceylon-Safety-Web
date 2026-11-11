"use server";

import { listPickerItems } from "./listPickerItems";
import type { ListPickerItemsInput, ListPickerItemsResult } from "@/types/video";

export async function listPickerItemsAction(input: ListPickerItemsInput): Promise<ListPickerItemsResult> {
  return listPickerItems(input);
}
