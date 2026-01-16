-- Add time_bank column to players table (in seconds, default 3)
ALTER TABLE players ADD COLUMN IF NOT EXISTS time_bank INTEGER DEFAULT 3;

-- Add hand_count column to rooms table
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS hand_count INTEGER DEFAULT 0;

-- Add turn_start_time column to hands table
ALTER TABLE hands ADD COLUMN IF NOT EXISTS turn_start_time TIMESTAMPTZ;
