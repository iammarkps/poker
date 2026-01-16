-- Add last_raise column to hands table
ALTER TABLE hands ADD COLUMN IF NOT EXISTS last_raise INTEGER DEFAULT 20;
