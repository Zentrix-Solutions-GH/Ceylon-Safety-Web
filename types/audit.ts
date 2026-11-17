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
  | "ads.settings_change"
  // Documents
  | "document.save"
  | "document.slug_change"
  | "document.file_upload"
  | "document.publish"
  | "document.hide"
  // Money and access
  | "order.grant"
  | "order.paid"
  | "order.chargeback"
  | "bank_transfer.approve"
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
