"use server";

import { getPublicDocument as _getPublicDocument } from "@/lib/documents/public";
import type { GetPublicDocumentResult } from "@/types/document";

export async function getPublicDocument(slug: string): Promise<GetPublicDocumentResult> {
  return _getPublicDocument(slug);
}
