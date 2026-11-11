"use server";

import { saveAuthor as _saveAuthor } from "@/lib/authors/actions/saveAuthor";
import type { SaveAuthorInput, SaveAuthorResult } from "@/types/author";

export async function saveAuthor(input: SaveAuthorInput): Promise<SaveAuthorResult> {
  return _saveAuthor(input);
}
