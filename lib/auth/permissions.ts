/**
 * The one permission map for server-side checks (auth design §11, AC4, AC8).
 *
 * These must exactly match the seeded role_permissions rows in
 * supabase/migrations/20261029000003_seed_content.sql, except for names in
 * SERVER_ONLY_PERMISSIONS which are server-code-only and never seeded.
 *
 * AC8: supabase/tests/permission-map.test.ts compares PERMISSION_MAP.admin
 * against the DB rows and fails the build if they differ.
 */

/** Seeded role_permissions actions for the Admin role. */
const ADMIN_PERMISSIONS = [
  "articles.*",
  "videos.*",
  "authors.*",
  "media.upload",
  "comments.moderate",
  "documents.*",
  "courses.*",
  "trainers.*",
  "pages.publish",
  "settings.site",
  "banners.read",
  "banners.write",
  "coupons.*",
  "bank_transfers.review",
  "download_requests.review",
  "orders.read",
  "users.read",
  "users.suspend",
] as const;

/**
 * Server-code-only permission names — not in the DB seed, used only in
 * server actions (e.g. support.download, orders.grant).
 * AC8 integration test excludes these from the DB comparison.
 */
export const SERVER_ONLY_PERMISSIONS: string[] = [
  "support.download",
  "orders.grant",
];

export const PERMISSION_MAP: Partial<Record<string, readonly string[]>> = {
  admin: ADMIN_PERMISSIONS,
  // maintainer: [] — no seeded rows; deny by default (assumptions accepted)
  // super_admin: passes everything — no row needed
};

