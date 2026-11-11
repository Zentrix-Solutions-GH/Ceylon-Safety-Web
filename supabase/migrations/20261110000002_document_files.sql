-- S-070: Add sort_order to document_files; update unique constraint and status CHECK.
-- Q70 resolved 2026-11-10: up to 3 preview images per language (sort_order 1–3).

BEGIN;

-- Add sort_order column (default 1 preserves existing rows as slot 1).
ALTER TABLE public.document_files
  ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 1;

ALTER TABLE public.document_files
  ADD CONSTRAINT document_files_sort_order_check CHECK (sort_order BETWEEN 1 AND 3);

-- Drop old unique constraint (document_id, kind, language) WHERE is_current.
DROP INDEX IF EXISTS document_files_current_unique;

-- New unique constraint includes sort_order.
CREATE UNIQUE INDEX document_files_current_unique
  ON public.document_files (document_id, kind, language, sort_order)
  WHERE is_current;

-- Extend status CHECK to include upload_failed (schema §14.5).
ALTER TABLE public.document_files
  DROP CONSTRAINT IF EXISTS document_files_status_check;

ALTER TABLE public.document_files
  ADD CONSTRAINT document_files_status_check
  CHECK (status IN ('pending', 'ready', 'upload_failed'));

-- Audit CHECK constraint — add document.file_upload, document.publish, document.hide.
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
    'settings.change',          'settings.contact_change',  'ads.settings_change',
    'order.grant',
    'bank_transfer.approve',    'bank_transfer.reject',
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
