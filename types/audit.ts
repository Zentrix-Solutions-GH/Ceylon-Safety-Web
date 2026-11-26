// Audit event types for admin_audit_log (admin panel design section 10.2).
// Backend writes this table only via lib/audit/index.ts — never directly.
// The list here must match the CHECK constraint in the latest migration.

export type AuditEventName =
  // Content
  | "article.save"
  | "article.publish"
  | "article.hide"
  | "article.delete"
  | "article.slug_change"
  | "video.add"
  | "video.update"
  | "video.publish"
  | "video.hide"
  | "video.unhide"
  | "video.delete"
  | "comment.approve"
  | "comment.reject"
  | "comment.delete"
  | "comment.restore"
  | "author.change"
  | "image.upload"
  // Courses and pages
  | "course.slug_change"
  | "page.publish"
  // Settings and ads
  | "settings.change"
  | "settings.contact_change"
  | "settings.business_change"
  | "ads.settings_change"
  // Documents
  | "document.save"
  | "document.slug_change"
  | "document.file_upload"
  | "document.publish"
  | "document.hide"
  // Money and access
  | "order.grant"
  | "order.cancel"
  | "order.resolve_review"
  | "order.resend_email"
  | "order.paid"
  | "order.chargeback"
  | "order.export"
  | "bank_transfer.approve"
  | "bank_transfer.first_approve" // gap fix: event was written by S-089 flow but missing from this union; added in S-090 migration
  | "bank_transfer.reject"
  | "download_request.approve"
  | "download_request.reject"
  | "coupon.create"
  | "coupon.update"
  | "price.change"
  // Staff and security
  | "role.change"
  | "admin.session_start"
  | "permission.denied"
  | "purge.failed"
  // Support reads (Q65 resolved; team decision)
  | "support.read"
  | "support.download"
  | "user.remove_mfa";

// S-100: owner alert event names (subset of AuditEventName plus owner-alert-specific triggers)
export type OwnerAlertEvent =
  | "settings.super_admin_change"      // any Super Admin-only settings group save
  | "settings.bank_details_change"     // bank_account_details changed (security — bypasses budget)
  | "settings.owner_alert_email_change"// owner_alert_email changed (security — bypasses budget)
  | "settings.contact_change"          // contact group saved (security — bypasses budget)
  | "role.change"                      // staff role or permission changed (security)
  | "document.language_file_replace"   // published doc language file replaced (security)
  | "price.drop_over_50pct"            // document price dropped > 50 % (security)
  | "page.publish_legal"               // legal page published (admin panel section 13.2)
  | "order.csv_export";                // CSV export run (S-090)

export type AuditEvent = {
  action: AuditEventName;
  // actorId is optional for system-generated events (e.g. payment webhook) where there is no human actor.
  actorId?: string;
  entityType?: string;
  entityId?: string;
  // before/after hold structured diffs. Sensitive values (8+ digit runs) are
  // masked by writeAuditRow before insert. A short human-readable summary is
  // stored as after._summary when the caller provides one.
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  summary?: string;
};
