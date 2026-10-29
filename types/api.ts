// Backend-owned. Defined here as a scaffold until backend fills in error codes.
// Shape: auth design §17 (M19).

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; code: string; reason?: string; field?: string };
