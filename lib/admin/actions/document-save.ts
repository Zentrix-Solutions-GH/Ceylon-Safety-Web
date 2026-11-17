'use server';
import { saveDocument as _saveDocument } from './documents';
import type { SaveDocumentInput, SaveDocumentResult } from '@/types/document';

export async function saveDocument(input: SaveDocumentInput): Promise<SaveDocumentResult> {
  return _saveDocument(input);
}
