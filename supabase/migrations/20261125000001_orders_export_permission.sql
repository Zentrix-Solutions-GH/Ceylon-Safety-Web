-- S-090: add orders.export permission for admin role and add order.export to
-- the admin_audit_log CHECK constraint.
-- Super Admin bypasses the table entirely (requireStaff skips the check for super_admin).
-- editor role intentionally excluded: export contains full buyer name + financials.

BEGIN;

INSERT INTO public.role_permissions (role, action)
VALUES ('admin', 'orders.export')
ON CONFLICT (role, action) DO NOTHING;

-- Extend the audit log CHECK constraint to include order.export (S-090).
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
    'order.export',
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
