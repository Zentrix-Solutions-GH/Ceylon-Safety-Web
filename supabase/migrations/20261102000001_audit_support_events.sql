-- S-038: Add support.read and support.download to the audit event CHECK constraint.
-- Team decision (Q65 resolved internally): support team is our own team and must
-- be able to read customer/payment data; all such reads are audit-logged (REQ-130g).
-- These event names appear in admin panel design section 10.2 and were PROPOSED
-- pending M16; the decision is now made.

BEGIN;

ALTER TABLE public.admin_audit_log
  DROP CONSTRAINT admin_audit_log_action_check;

ALTER TABLE public.admin_audit_log
  ADD CONSTRAINT admin_audit_log_action_check CHECK (action IN (
    'article.save',             'article.publish',          'article.hide',
    'article.delete',           'article.slug_change',
    'video.add',                'video.update',             'video.publish',
    'video.hide',               'video.unhide',             'video.delete',
    'comment.approve',          'comment.reject',           'comment.delete',
    'comment.restore',          'author.change',            'image.upload',
    'course.slug_change',       'page.publish',
    'settings.change',          'settings.contact_change',  'ads.settings_change',
    'order.grant',
    'bank_transfer.approve',    'bank_transfer.reject',
    'download_request.approve', 'download_request.reject',
    'coupon.create',            'coupon.update',            'price.change',
    'role.change',              'admin.session_start',      'permission.denied',
    'purge.failed',
    'support.read',             'support.download'
  ));

COMMIT;
