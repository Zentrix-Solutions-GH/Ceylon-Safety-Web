-- S-099: Settings backend
-- 1. Move owner_alert_email from 'system' group to 'business' group so the
--    business settings card can edit it (requires settings.business permission,
--    matching AC2). The trigger allows setting_group changes only via
--    service-role; this migration runs as the migration user (service role).
-- 2. Add settings.business_change to admin_audit_log action CHECK (AC6).

-- ── 1. Move owner_alert_email to business group ───────────────────────────────

UPDATE public.site_settings
SET setting_group = 'business'
WHERE key = 'owner_alert_email';

-- ── 2. Add owner_alert_email column note ─────────────────────────────────────
-- (no schema change needed; is_public stays false)

-- ── 3. Extend admin_audit_log.action CHECK ───────────────────────────────────

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
