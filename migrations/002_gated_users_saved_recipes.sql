-- PlateMate: gated app — user profiles (incl. allergies) + saved_recipes FK → users
-- PostgreSQL 11+. Re-run safe (IF NOT EXISTS / guarded DO blocks).

-- ── users ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                    SERIAL PRIMARY KEY,
  name                  TEXT        NOT NULL,
  email                 TEXT        NOT NULL,
  password_hash         TEXT        NOT NULL,
  allergies             TEXT[]      NOT NULL DEFAULT '{}',
  dietary_restriction TEXT        NOT NULL DEFAULT '',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Existing DBs: add columns if missing
ALTER TABLE users ADD COLUMN IF NOT EXISTS allergies TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS dietary_restriction TEXT NOT NULL DEFAULT '';

-- Case-insensitive unique email (matches app’s lowercased inserts)
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique ON users (lower(email));

-- ── saved_recipes ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_recipes (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER     NOT NULL,
  recipe_name TEXT        NOT NULL,
  recipe_text TEXT,
  video_id    VARCHAR(32),
  saved_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, recipe_name)
);

ALTER TABLE saved_recipes ADD COLUMN IF NOT EXISTS recipe_text TEXT;
ALTER TABLE saved_recipes ADD COLUMN IF NOT EXISTS video_id VARCHAR(32);
ALTER TABLE saved_recipes ADD COLUMN IF NOT EXISTS saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- FK to users (ON DELETE CASCADE). Fix orphan rows first if this errors:
--   DELETE FROM saved_recipes s WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = s.user_id);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'saved_recipes' AND column_name = 'user_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'saved_recipes' AND c.conname = 'saved_recipes_user_id_fkey'
  ) THEN
    ALTER TABLE saved_recipes
      ADD CONSTRAINT saved_recipes_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
  END IF;
END
$$;
