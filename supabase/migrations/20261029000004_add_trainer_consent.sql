-- S-020 follow-up: add consent_confirmed to trainers (M32/Q61 decision)
-- The seed migration (20261029000003) inserted trainers before this column existed.
-- This migration adds the column and marks the seeded trainers as consent confirmed.

ALTER TABLE public.trainers
  ADD COLUMN consent_confirmed boolean NOT NULL DEFAULT false;

-- Mark the three trainers seeded by 20261029000003 as consent confirmed.
-- These rows represent clients who have given consent before go-live (M32/Q61).
UPDATE public.trainers
SET consent_confirmed = true
WHERE slug IN ('nimal-perera', 'chaminda-silva', 'priyanka-fernando');
