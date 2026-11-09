import "server-only";

// Sentinel UUID written to audit rows when no authenticated actor is available
// (e.g. a permission.denied row recorded before auth succeeds).
export const ANON_ACTOR = "00000000-0000-0000-0000-000000000000";
