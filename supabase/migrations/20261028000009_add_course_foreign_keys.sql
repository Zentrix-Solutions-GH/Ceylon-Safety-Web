-- S-018 AC6: Add course_id foreign keys to order_items and entitlements.
-- Runs after S-016 (00007) and S-017 (00008) which create those tables with
-- a nullable course_id column but no FK constraint yet.
-- Uses column-existence guards so the migration is safe on a schema that
-- does not yet have S-016/S-017 applied (the FK is then a no-op; it will be
-- added when S-016/S-017 migrations are applied in the future).

DO $$
BEGIN
  -- order_items.course_id FK
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'order_items'
      AND column_name  = 'course_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema     = 'public'
      AND tc.table_name       = 'order_items'
      AND tc.constraint_type  = 'FOREIGN KEY'
      AND kcu.column_name     = 'course_id'
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_course_id_fkey
      FOREIGN KEY (course_id) REFERENCES public.courses (id) ON DELETE RESTRICT;
  END IF;

  -- entitlements.course_id FK
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'entitlements'
      AND column_name  = 'course_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema    = 'public'
      AND tc.table_name      = 'entitlements'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name    = 'course_id'
  ) THEN
    ALTER TABLE public.entitlements
      ADD CONSTRAINT entitlements_course_id_fkey
      FOREIGN KEY (course_id) REFERENCES public.courses (id) ON DELETE RESTRICT;
  END IF;
END;
$$;

-- Indexes are created by S-016/S-017 on the course_id column; no index
-- needed here since the FK constraint itself does not create one automatically.
-- S-016 is expected to create an index on order_items(course_id).
-- S-017 is expected to create an index on entitlements(course_id).
