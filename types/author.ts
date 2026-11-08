// S-052: Authors admin backend contract.
// Backend defines; frontend consumes (S-057 picker, S-058 screen).

export interface Author {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  isActive: boolean;
  updatedAt: string;
}

export interface SaveAuthorInput {
  /** Present → update; absent → create */
  id?: string;
  name: string;
  bio?: string | null;
  /** Required for updates; used for optimistic-lock check (admin panel section 12). */
  updatedAt?: string;
}

export type SaveAuthorErrorCode =
  | "not_allowed"
  | "validation_failed"
  | "version_conflict"
  | "not_found"
  | "unknown";

export type SaveAuthorResult =
  | { ok: true; author: Author }
  | { ok: false; code: SaveAuthorErrorCode; field?: string };

export type SetAuthorActiveErrorCode =
  | "not_allowed"
  | "version_conflict"
  | "not_found"
  | "unknown";

export type SetAuthorActiveResult =
  | { ok: true; author: Author }
  | { ok: false; code: SetAuthorActiveErrorCode };

export type ListAuthorsInput = {
  includeInactive?: boolean;
};

export type ListAuthorsResult =
  | { ok: true; authors: Author[] }
  | { ok: false; code: "not_allowed" | "unknown" };
