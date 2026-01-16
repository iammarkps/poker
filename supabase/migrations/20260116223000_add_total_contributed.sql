-- Track per-hand total contributions to compute side pots accurately
ALTER TABLE player_hands
ADD COLUMN IF NOT EXISTS total_contributed INTEGER DEFAULT 0;

-- Backfill existing rows to current_bet so historical hands remain consistent
UPDATE player_hands SET total_contributed = current_bet WHERE total_contributed IS NULL;
