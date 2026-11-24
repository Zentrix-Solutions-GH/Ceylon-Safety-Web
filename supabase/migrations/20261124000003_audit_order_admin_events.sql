-- S-089: Add order.cancel, order.resolve_review, order.resend_email to the
-- admin_audit_log CHECK constraint.
-- Written by cancelPendingOrder, resolveReview, and resendOrderEmail in
-- lib/admin/actions/orders.ts (this story).

BEGIN;

ALTER TABLE public.admin_audit_log
  DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;

ALTER TABLE public.admin_audit_log
  ADD CONSTRAINT admin_audit_log_action_check CHECK (action IN (
    'article.save',             'article.publish',          'article.hide',
    'article.delete',           'article.slug_change',
    'video.add',                'video.update',             'video.publish',
    'video.hide',               'video.unhide',             'video.delete',
    'comment.approve',          'comment.reject',           'comment.delete',
    'comment.restore',          'author.change',            'image.upload',
    'course.slug_change',       'page.publish',
    'settings.change',          'settings.contact_change',  'settings.business_change',
    'ads.settings_change',
    'order.grant',              'order.paid',               'order.chargeback',
    'order.cancel',             'order.resolve_review',     'order.resend_email',
    'bank_transfer.approve',    'bank_transfer.first_approve',
    'bank_transfer.reject',     'bank_transfer.reopen',
    'download_request.approve', 'download_request.reject',
    'coupon.create',            'coupon.update',            'price.change',
    'role.change',              'admin.session_start',      'permission.denied',
    'purge.failed',
    'support.read',             'support.download',
    'user.remove_mfa',
    'document.save',            'document.slug_change',
    'document.file_upload',     'document.publish',         'document.hide'
  ));

COMMIT;
