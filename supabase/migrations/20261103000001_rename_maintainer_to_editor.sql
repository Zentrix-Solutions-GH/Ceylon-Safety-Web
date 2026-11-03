-- S-039: Rename 'maintainer' role to 'editor' in CHECK constraints and seed.
-- Q62/Q63 answered 2026-11-03: Editor = full admin access except User Roles and Settings.
-- Migrates any existing 'maintainer' rows and re-seeds role_permissions for editor.

BEGIN;

-- 1. Drop old CHECK constraints so the data migration can write 'editor'
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE public.role_permissions
  DROP CONSTRAINT IF EXISTS role_permissions_role_check;

-- 2. Add new CHECK constraints with 'editor'
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('super_admin', 'admin', 'editor'));

ALTER TABLE public.role_permissions
  ADD CONSTRAINT role_permissions_role_check
  CHECK (role IN ('super_admin', 'admin', 'editor'));

-- 3. Migrate existing 'maintainer' rows now that constraints allow 'editor'
UPDATE public.user_roles SET role = 'editor' WHERE role = 'maintainer';
UPDATE public.role_permissions SET role = 'editor' WHERE role = 'maintainer';

-- 7. Replace custom_access_token_hook to emit 'editor' instead of 'maintainer'
CREATE OR REPLACE FUNCTION private.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id  uuid;
  v_role     text;
  v_status   text;
  v_claims   jsonb;
BEGIN
  v_user_id := (event->>'userId')::uuid;

  SELECT role INTO v_role
    FROM public.user_roles
   WHERE user_id = v_user_id
   LIMIT 1;

  SELECT status INTO v_status
    FROM public.profiles
   WHERE id = v_user_id;

  v_claims := event->'claims';

  IF v_role IS NOT NULL THEN
    v_claims := jsonb_set(v_claims, '{user_role}', to_jsonb(v_role));
  END IF;

  IF v_status IS NOT NULL THEN
    v_claims := jsonb_set(v_claims, '{account_status}', to_jsonb(v_status));
  END IF;

  RETURN jsonb_set(event, '{claims}', v_claims);
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'custom_access_token_hook error for user %: %', v_user_id, SQLERRM;
    RETURN event;
END;
$$;

-- 8. Seed editor role_permissions (all admin actions minus users.read, users.suspend, settings.site)
-- Editor = full access except User Roles and Settings (Q63 confirmed 2026-11-03)
INSERT INTO public.role_permissions (role, action) VALUES
  ('editor', 'articles.*'),
  ('editor', 'videos.*'),
  ('editor', 'authors.*'),
  ('editor', 'media.upload'),
  ('editor', 'comments.moderate'),
  ('editor', 'documents.*'),
  ('editor', 'courses.*'),
  ('editor', 'trainers.*'),
  ('editor', 'pages.publish'),
  ('editor', 'banners.read'),
  ('editor', 'banners.write'),
  ('editor', 'coupons.*'),
  ('editor', 'bank_transfers.review'),
  ('editor', 'download_requests.review'),
  ('editor', 'orders.read')
ON CONFLICT (role, action) DO NOTHING;

-- 9. Add user.remove_mfa to the admin_audit_log CHECK constraint
ALTER TABLE public.admin_audit_log
  DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;

ALTER TABLE public.admin_audit_log
  ADD CONSTRAINT admin_audit_log_action_check CHECK (action IN (
    'article.save',           'article.publish',         'article.hide',
    'article.delete',         'article.slug_change',
    'video.add',              'video.update',            'video.publish',
    'video.hide',             'video.unhide',            'video.delete',
    'comment.approve',        'comment.reject',          'comment.delete',
    'comment.restore',        'author.change',           'image.upload',
    'course.slug_change',     'page.publish',
    'settings.change',        'settings.contact_change', 'ads.settings_change',
    'order.grant',
    'bank_transfer.approve',  'bank_transfer.reject',
    'download_request.approve','download_request.reject',
    'coupon.create',          'coupon.update',           'price.change',
    'role.change',            'admin.session_start',     'permission.denied',
    'purge.failed',
    'support.read',           'support.download',
    'user.remove_mfa'
  ));

COMMIT;
