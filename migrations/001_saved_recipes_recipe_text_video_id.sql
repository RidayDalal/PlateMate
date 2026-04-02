-- Run once against your PlateMate database (psql, pgAdmin, etc.)
ALTER TABLE saved_recipes
  ADD COLUMN IF NOT EXISTS recipe_text TEXT,
  ADD COLUMN IF NOT EXISTS video_id VARCHAR(32);

-- Optional: require text for new saves only; existing rows may have NULL until re-saved.
