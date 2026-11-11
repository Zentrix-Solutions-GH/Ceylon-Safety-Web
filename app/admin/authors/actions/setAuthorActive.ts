"use server";

import { setAuthorActive as _setAuthorActive } from "@/lib/authors/actions/setAuthorActive";
import type { SetAuthorActiveResult } from "@/types/author";

export async function setAuthorActive(input: {
  id: string;
  active: boolean;
  updatedAt: string;
}): Promise<SetAuthorActiveResult> {
  return _setAuthorActive(input);
}
